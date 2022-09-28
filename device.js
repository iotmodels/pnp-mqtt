import mqtt from './mqttClient.js'
let client

const repoBaseUrl = 'https://iotmodels.github.io/dmr/' // 'https://devicemodels.azure.com'
const dtmiToPath = function (dtmi) {
    return `/${dtmi.toLowerCase().replace(/:/g, '/').replace(';', '-')}.json`
}

const isBuffer = obj => {
    return obj != null && obj.constructor != null &&
        typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

const isObject = obj => Object.prototype.toString.call(obj) === '[object Object]'

const resolveSchema = s => {
    if (!isObject(s) && s.startsWith('dtmi:')) {
        console.log('not supported schema', s)
        return null
    } else if (isObject(s) && s['@type'] === 'Enum') {
        return s.valueSchema
    } else {
        return s
    }
}


export default {
    data: () => ({
        device: {},
        properties: [],
        commands: [],
        telemetries: [],
        modelpath: '',
        telemetryValues: {}
    }),
    created() {
        client = mqtt.start()
        this.initModel()
        this.fetchData()
    },
    methods: {
        async initModel() {
            const qs =  new URLSearchParams(window.location.search)
            this.device = { 
                deviceId: qs.get('id'), 
                modelId: qs.get('model-id'), 
                properties: {
                    reported: {},
                    desired: {}
                }}
            this.modelpath = `${repoBaseUrl}${dtmiToPath(this.device.modelId)}`
            const model = await (await window.fetch(this.modelpath)).json()
            this.properties = model.contents.filter(c => c['@type'].includes('Property'))
            this.commands = model.contents.filter(c => c['@type'].includes('Command'))
            this.telemetries = model.contents.filter(c => c['@type'].includes('Telemetry'))
        },
        async fetchData() {
          
            client.on('error', e => console.error(e))
            client.on('connect', () => {
                console.log('connected', client.connected)
                client.subscribe(`device/${this.device.deviceId}/#`)
                client.subscribe(`registry/${this.device.deviceId}/status`)
                })
            client.on('message', (topic, message) => {
                let msg = {}
                if (isBuffer(message)) {
                    const s = message.toString()
                    if (s[0] == '{') {
                        msg = JSON.parse(message)
                    } else {
                        msg = s
                    }

                }
                //const msg = JSON.parse(message)
                // console.log(topic, msg)
                const ts = topic.split('/')
                if (topic === `registry/${this.device.deviceId}/status`) {
                    this.device.connectionState = msg.status === 'online' ? 'Connected' : 'Disconnected'
                    this.device.lastActivityTime = msg.when
                }
                if (topic.startsWith(`device/${this.device.deviceId}/props`)) {
                    const propName = ts[3]
                    if (topic.endsWith('/set'))
                    {
                        this.device.properties.desired[propName] = msg
                    } else {
                        this.device.properties.reported[propName] = msg
                    }
                }
                if (topic.startsWith(`device/${this.device.deviceId}/commands`)) {
                    const cmdName = ts[3]
                    const cmd = this.commands.filter(c => c.name === cmdName)[0]
                    // const cmdRespSchema = resolveSchema(cmd.response.schema)
                    cmd.responseMsg = msg
                }
                if (topic === `device/${this.device.deviceId}/telemetry`) {
                    const maxItems = 10
                    const telName = Object.keys(msg)[0]
                    Object.keys(msg).forEach(k => {
                        this.telemetryValues[k] = []
                        this.telemetryValues[k].push(msg[k])
                    })
                }
            })

            document.title = this.device.deviceId
        },
        async handlePropUpdate(name, val, schema) {
            const resSchema = resolveSchema(schema)
            this.device.properties.desired[name] = ''
            this.device.properties.reported[name] = ''
            const topic = `device/${this.device.deviceId}/props/${name}/set`
            let desiredValue = {}
            switch (resSchema) {
                case 'string':
                    desiredValue = val
                    break
                case 'integer':
                    desiredValue = parseInt(val)
                    break
                case 'boolean':
                    desiredValue = (val === 'true')
                    break
                case 'double':
                    desiredValue = parseFloat(val)
                    break
                default:
                    console.log('schema serializer not implemented', resSchema)
                    throw new Error('Schema serializer not implemented for' + Json.stringify(resSchema))
            }
            client.publish(topic,JSON.stringify(desiredValue), {qos:1, retain: true})            
        },
        onCommand (cmdName, cmdReq) {
            const topic = `device/${this.device.deviceId}/commands/${cmdName}`
            client.publish(topic,JSON.stringify(cmdReq), {qos:1, retain: false})            
        },
        formatDate(d) {
            if (d === '0001-01-01T00:00:00Z') return ''
            return moment(d).fromNow()
        },
        gv(object, string, defaultValue = '') {
            // https://stackoverflow.com/questions/70283134
            return _.get(object, string, defaultValue)
        }
    }
}