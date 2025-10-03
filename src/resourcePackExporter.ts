import fs from "fs";
import path from "path";
import { AJMetaFile } from "./ajmeta";
import { isValidResourcePackPath, safeFunctionName } from "./minecraft";
import { CustomModelData, IRenderedRig } from "./rendering/modelRenderer";
import { animatedJavaSettings } from "./settings";
import { ExpectedError, LimitClock } from "./util/misc";
import { ProgressBarController } from "./util/progress";
import { translate } from "./util/translation";
import { VirtualFolder } from "./util/virtualFileSystem";

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function exportResources(
  ajSettings: typeof animatedJavaSettings,
  projectSettings: NotUndefined<ModelProject["animated_java_settings"]>,
  rig: IRenderedRig,
  rigExportFolder: string,
  textureExportFolder: string,
  rigItemModelExportPath: string
) {
  const version = projectSettings.target_minecraft_version.value;
  const advancedResourcePackSettingsEnabled = projectSettings.enable_advanced_resource_pack_settings.value;
  const projectNamespace = projectSettings.project_namespace.value;
  const resourcePackPath = path.parse(projectSettings.resource_pack_mcmeta.value).dir;

  const resourcePackFolder = new VirtualFolder(
    advancedResourcePackSettingsEnabled ? "internal_resource_pack_folder" : path.basename(resourcePackPath),
    undefined,
    true
  );

  const assetsFolder = resourcePackFolder.newFolder("assets");
  const animatedJavaFolder = assetsFolder.newFolder("animated_java");

  const minecraftRoot = assetsFolder.newFolder("minecraft");
  let minecraftItemsFolder;

  if (version === 0) {
    const minecraftModelsFolder = minecraftRoot.newFolder("models");
	  minecraftItemsFolder = minecraftModelsFolder.newFolder("item");
  } else {
    const minecraftModelsFolder = minecraftRoot;
	  minecraftItemsFolder = minecraftModelsFolder.newFolder("items");
  }

  const [rigItemNamespace, rigItemName] = projectSettings.rig_item.value.split(":");
  const predicateItemFilePath = advancedResourcePackSettingsEnabled
    ? rigItemModelExportPath
    : path.join(path.dirname(resourcePackPath), minecraftItemsFolder.path, `${rigItemName}.json`);

  const usedIds: number[] = [1]; // Reserve ID 1 for animated_java_empty
  const consumedIds: number[] = [];

  minecraftItemsFolder.newFile("animated_java_empty.json", "{}");

  const [modelsFolder, texturesFolder] = animatedJavaFolder.newFolders(
    `/models/item/${projectNamespace}`,
    `/textures/item/${projectNamespace}`
  );

  for (const texture of Object.values(rig.textures)) {
    let image: Buffer | undefined;
    let mcmeta: Buffer | undefined;
    let optifineEmissive: Buffer | undefined;

    if (texture.source?.startsWith("data:")) {
      image = Buffer.from(texture.source.split(",")[1], "base64");
    } else if (texture.path && fs.existsSync(texture.path)) {
      if (!isValidResourcePackPath(texture.path)) {
        image = await fs.promises.readFile(texture.path);
        if (fs.existsSync(texture.path + ".mcmeta"))
          mcmeta = await fs.promises.readFile(texture.path + ".mcmeta");
        const emissivePath = texture.path.replace(".png", "") + "_e.png";
        if (fs.existsSync(emissivePath))
          optifineEmissive = await fs.promises.readFile(emissivePath);
      }
    }

    if (!image) continue;

    const textureName = safeFunctionName(texture.name);
    texturesFolder.newFile(`${textureName}.png`, image);
    if (mcmeta) texturesFolder.newFile(`${textureName}.png.mcmeta`, mcmeta);
    if (optifineEmissive) texturesFolder.newFile(`${textureName}_e.png`, optifineEmissive);
  }

  for (const bone of Object.values(rig.nodeMap)) {
    if (bone.type !== "bone") continue;
    modelsFolder.newFile(`${bone.name}.json`, bone.model);
  }

  for (const [variantName, variantBoneMap] of Object.entries(rig.variantModels)) {
    if (variantBoneMap.default) continue;
    const variantFolder = modelsFolder.newFolder(variantName);
    for (const [uuid, variantBone] of Object.entries(variantBoneMap)) {
      const bone = rig.nodeMap[uuid];
      if (bone.type !== "bone") continue;
      variantFolder.newFile(`${bone.name}.json`, variantBone.model);
    }
  }

  minecraftRoot.newFolder("atlases").newFile("blocks.json", {
    sources: [{ type: "item", source: "animated_java:blueprint_source" }]
  });

  let predicateItemFile;

  CustomModelData.usedIds = usedIds; // Lock in reserved ID 1

  if (version === 0) {
    // ✅ Legacy format for 1.20.5–1.21.3
    const predicateContent = {
      parent: "item/generated",
      textures: {
        layer0: `${rigItemNamespace}:item/${rigItemName}`
      },
      overrides: [
        {
          predicate: { custom_model_data: 1 },
          model: "item/animated_java_empty"
        }
      ],
      animated_java: {
        rigs: {}
      }
    };

    for (const bone of Object.values(rig.nodeMap)) {
      if (bone.type !== "bone") continue;
      const id = CustomModelData.get(); // Starts at 2
      consumedIds.push((bone.customModelData = id));
      usedIds.push(id);
      predicateContent.overrides.push({
        predicate: { custom_model_data: id },
        model: bone.resourceLocation
      });
    }

    predicateContent.overrides.sort((a, b) => a.predicate.custom_model_data - b.predicate.custom_model_data);
    predicateContent.animated_java.rigs[projectNamespace] = { used_ids: consumedIds };

    predicateItemFile = minecraftItemsFolder.newFile(`${rigItemName}.json`, predicateContent);
  } else {
    // ✅ New format for 1.21.4+
    const entries: Array<{ threshold: number; model: { type: string; model: string } }> = [
	{
		threshold: 1,
		model: {
		type: "model",
		model: "animated_java:item/animated_java_empty"
		}
	}
	];

    for (const bone of Object.values(rig.nodeMap)) {
      if (bone.type !== "bone") continue;
      const id = CustomModelData.get(); // Starts at 2
      consumedIds.push((bone.customModelData = id));
      usedIds.push(id);

      entries.push({
        threshold: id,
        model: {
          type: "model",
          model: bone.resourceLocation
        }
      });
    }

    entries.sort((a, b) => a.threshold - b.threshold);

    const fallbackModel = `${rigItemNamespace}:items/${rigItemName}`;
    const predicateContent = {
      model: {
        type: "range_dispatch",
        property: "custom_model_data",
        fallback: {
          type: "model",
          model: fallbackModel
        },
        entries
      },
      animated_java: {
        rigs: {
          [projectNamespace]: { used_ids: consumedIds }
        }
      }
    };

    predicateItemFile = minecraftItemsFolder.newFile(`${rigItemName}.json`, predicateContent);
  }

  const filePaths = [...modelsFolder.getAllFilePaths(), ...texturesFolder.getAllFilePaths()];
  const ajMetaPath = path.join(resourcePackPath, "resourcepack.ajmeta");
  const ajmeta = new AJMetaFile();

  if (await fileExists(ajMetaPath)) await ajmeta.load(ajMetaPath);

  let project = ajmeta.getProject(Project!.animated_java_uuid!);
  if (!project) {
    project = ajmeta.addProject(Project!.animated_java_uuid!, projectNamespace, filePaths);
  }

  project.file_list = filePaths;

  await fs.promises.writeFile(
    ajMetaPath,
    ajSettings.minify_output.value
      ? JSON.stringify(ajmeta.toJSON())
      : JSON.stringify(ajmeta.toJSON(), null, 4)
  );

  const predicateItemExportFolder = path.parse(rigItemModelExportPath).dir;

  if (version === 0) {
	await fs.promises.mkdir(path.join(resourcePackPath, "assets/minecraft/models/item"), {
		recursive: true
	});
	await minecraftItemsFolder.writeChildrenToDisk(
		path.join(resourcePackPath, "assets/minecraft/models/item"),
		{ skipEmptyFolders: true }
	);
  } else {
	await fs.promises.mkdir(path.join(resourcePackPath, "assets/minecraft/items"), {
		recursive: true
	});
	await minecraftItemsFolder.writeChildrenToDisk(
		path.join(resourcePackPath, "assets/minecraft/items"),
		{ skipEmptyFolders: true }
	);
  }

  await fs.promises.mkdir(rigExportFolder, { recursive: true });
  await modelsFolder.writeChildrenToDisk(rigExportFolder, { skipEmptyFolders: true });

  await fs.promises.mkdir(textureExportFolder, { recursive: true });
  await texturesFolder.writeChildrenToDisk(textureExportFolder, { skipEmptyFolders: true });

  await fs.promises.mkdir(predicateItemExportFolder, { recursive: true });
  await predicateItemFile.writeToDisk(predicateItemExportFolder, { skipEmptyFolders: true });
}