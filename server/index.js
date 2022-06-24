const fs = require('fs')
const path = require('path')

const { config } = require('dotenv')
const { Client, Intents } = require('discord.js')

const data = require('../packages/metadata.json')

config()

const packagePath = (name, relative) => {
    const absolutePath = `packages/${name.split('_')[0].toLowerCase()}/${name}`

    return relative 
        ? path.resolve('.', `./${absolutePath}`) 
        : `https://github.com/ghostrider-05/discord-dummy/raw/main/${absolutePath}`
}

const sizeOf = (name) => Math.round(fs.statSync(packagePath(name, true)).size / 1000)

const filterNames = (initial) => (compare) => {
    return initial === compare
        || initial === compare.toLowerCase()
        || initial.toLowerCase() === compare.toLowerCase()
        || compare.toLowerCase().includes(initial)
}

const client = new Client({ intents: [Intents.FLAGS.GUILDS] })

client.once('ready', async () => {
    if (process.env.COMMAND_TASK !== 'create') return 

    const command = {
        name: 'mapmaking',
        description: 'Test command. Version: ' + data.version,
        options: [
            {
                type: 1,
                name: 'resource',
                description: 'resources go brrrrrrrrrr',
                options: [
                    {
                        type: 3,
                        autocomplete: true,
                        name: 'package',
                        description: 'the name of the package'
                    }
                ]
            }
        ]
    }

    client.api.applications(client.user.id).commands.post({
        data: command
    })
})

client.on('interactionCreate', (interaction) => {
    if (interaction.isAutocomplete()) {
        const value = interaction.options.getString('package', false).toLowerCase()

        interaction.respond(data.packages.filter(filterNames(value)).filter((_, i) => i < 25).map(n => ({ name: n, value: n })))

    } else if (interaction.isCommand()) {
        const value = interaction.options.getString('package', false)

        const isValid = !data.unsupported.some(filterNames(value))
        const name = isValid ? data.packages.find(filterNames(value)) : undefined

        if (!name && isValid) return interaction.reply({ content: 'Unable to find package: ' + name ?? value, ephemeral: true })
        else if (!isValid) return interaction.reply({ content: 'Unable to decrypt package: ' + value, ephemeral: true })
        else return interaction.reply({
            ephemeral: true,
            embeds: [
                {
                    title: name,
                    description: `File size: ${sizeOf(name)}kB\nVersion: ${process.env.RL_VERSION}`
                }
            ],
            components: [
                {
                    type: 1,
                    components: [
                        {
                            type: 2,
                            label: 'Download package',
                            style: 5,
                            url: packagePath(name)
                        }
                    ]
                }
            ]
        })
    }
})

client.login()