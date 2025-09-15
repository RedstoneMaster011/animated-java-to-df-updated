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