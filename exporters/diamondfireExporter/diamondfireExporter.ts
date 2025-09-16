// @ts-ignore
import en from './lang/en.yaml'
// @ts-ignore
import de from './lang/de.yaml'
// @ts-ignore
import zh from './lang/zh_cn.yaml'

import { getItem } from './diamondfireConstructor'

export function loadExporter() {
    const API = AnimatedJava.API

    API.addTranslations('en', en as Record<string, string>)

    new API.Exporter({
        id: 'animated_java:diamondfire_exporter',
        name: API.translate('animated_java.exporters.diamondfire_exporter.name'),
        description: API.translate('animated_java.exporters.diamondfire_exporter.description'),
        getSettings() {
            return {
                minecraft_mod: new API.Settings.DropdownSetting({
                    id: 'animated_java:diamondfire_exporter/mod',
                    displayName: API.translate(
                        'animated_java.exporters.diamondfire_exporter.settings.mod'
                    ),
                    description: API.translate(
                        'animated_java.exporters.diamondfire_exporter.settings.mod.description'
                    ).split('\n'),
                    defaultValue: 0,
                    options: [
                        { name: 'Codeclient', value: 'Codeclient' },
                    ],
                }),
            }
        },
        settingsStructure: [
            {
                type: 'setting',
                settingId: 'animated_java:diamondfire_exporter/mod',
            },
        ],
        async export(exportOptions) {
            console.log('Export Options:', exportOptions)

            const itemCommand = await getItem(exportOptions)
            console.log('Generated give command:', itemCommand)

            if (exportOptions.exporterSettings.minecraft_mod._value == 0) {
                const ws = new WebSocket('ws://localhost:31375')

                function doSend() {
                    try {
                        ws.send(itemCommand)
                        ws.send(`give {components:{"minecraft:custom_data":{PublicBukkitValues:{"hypercube:codetemplatedata":'{"author":"RedstoneMaster01","name":"&b&lFunction &3» &bUnnamed","version":1,"code":"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"}'}},"minecraft:custom_name":'{"extra":[{"color":"#00F0FF","text":"Animated-Java To Diamondfire Loader Functions"}],"italic":false,"text":""}',"minecraft:lore":['{"bold":false,"color":"white","extra":[{"color":"gray","text":"This Is The Loader For |||Animated-Java-To-DF-Updated||| By RedstoneMaster01"}],"italic":false,"obfuscated":false,"strikethrough":false,"text":"","underlined":false}']},count:1,id:"minecraft:glass"}`)
                        // Bugged. ws.send(`give {components:{"minecraft:custom_name":'{"extra":[{"color":"dark_gray","text":"Help"}],"italic":false,"text":""}',"minecraft:written_book_content":{author:"RedstoneMaster01",pages:[{raw:'"&8When You Get The Model And Loader Code, Place Them In Your Codespace, Then You Want To Generate A Model Or Register A Model With A ID This ID Will Be The ID Of The Model, To Find It Look On The Model Code It Will Be consts.rig.<modelID>\\nso thats the name\\n&7Page 1"'},{raw:'"&8&8When You Have Registered A Model You Can Summon A Model, It Needs A Entity ID So You Will Want This To Be Dif From All The Other Entity IDs. Then Add Your Model ID. Then Put In The Location You Want To Spawn It On.\\n\\n&7Page 2"'},{raw:'"&8To Remove&8 A Model Use Remove Model And Add Your Entity ID To Remove It. Then Give It\\nThe Model ID.\\n\\n\\n\\n\\n\\n\\n\\n\\n&7Page 3"'},{raw:'"&8To Move A Model Use Teleport Model And Enter Your Entity ID. Then Enter Your Model ID. Then Your Location And Your Model Will Move There\\n\\n\\n\\n\\n\\n\\n&7Page 4"'},{raw:'"&8If You Want To Select Your Model With A Selection Tag Put In model_id then Entity ID\\nThen Filter if Entity Has Model ID And That Will Select Your ModelID.\\n\\n\\n\\n\\n\\n\\n&7Page 5"'},{raw:'"&8By RedstoneMaster01"'}],resolved:1b,title:{raw:"Help"}}},count:1,id:"minecraft:written_book"}`)
                        setTimeout(() => ws.close(), 150)
                    } catch (err) {
                        console.error('Failed to send item command:', err)
                    }
                }

                ws.addEventListener('open', () => {
                    doSend()
                })
                ws.addEventListener('error', (e) => {
                    console.error('WebSocket error:', e)
                })
                ws.addEventListener('close', (e) => {
                    console.log('WebSocket closed:', e)
                })

                if (ws.readyState === WebSocket.OPEN) {
                    doSend()
                }
            }
        },
    })
}