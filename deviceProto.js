import mqtt from './mqttClient.js'
let client

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
let root
let Telemetries
let Properties
let Commands
let PropertiesSetter
let ack
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
        async loadModel(modelId) {
            root = await protobuf.load(modelId)
            this.modelpath = modelId
            Telemetries = root.lookupType('Telemetries')
            Properties = root.lookupType('Properties')
            PropertiesSetter = root.lookupService('PropertiesSetter')
            Commands = root.lookupService('Commands')
            ack = root.lookupType('ack')
            Object.keys(Telemetries.fields).forEach( t => {
                this.telemetries.push({name: Telemetries.fields[t].name})
            })
            Object.keys(Properties.fields).forEach( t => {
                this.properties.push({name: Properties.fields[t].name, writable: false})
            })
            Object.keys(Commands.methodsArray).forEach(k => {
                const method = Commands.methodsArray[k]
                const req = root.lookupType(method.requestType)
                const res = root.lookupType(method.responseType)
                this.commands.push({
                    name: method.name,
                    request: {
                        name : req.name,
                        schema: ''
                    },
                    response: {
                        name : res.name,
                        schema: ''
                    }
                })
                const curCmd = this.commands.filter(c => c.name === method.name)[0]
                Object.keys(req.fields)
                    .forEach(k => { 
                        curCmd.request.schema += req.fields[k].type
                    })
                Object.keys(res.fields)
                    .forEach(k => { 
                        curCmd.response.schema += res.fields[k].type
                    })

            })
            Object.keys(PropertiesSetter.methodsArray).forEach(k => {
                const method = PropertiesSetter.methodsArray[k]
                const req = root.lookupType(method.requestType)
                Object.keys(req.fields)
                    .filter(f => f === method.name.substring(4)) // only props by set_ 
                    .forEach(k => {
                        //console.log('    ' + req.fields[k].name + ': ' + req.fields[k].type)
                        const prop = this.properties.filter(p=>p.name===k)[0]
                        prop.writable = true
                        prop.schema = 'integer'
                    })    
                const res = root.lookupType(method.responseType)
                Object.keys(res.fields)
                    .forEach(k => console.log('    ' + res.fields[k].name + ': ' + res.fields[k].type))    
            })
        },
        async initModel() {
            const qs =  new URLSearchParams(window.location.search)
            document.title = qs.get('id')
            await this.loadModel(qs.get('model-id'))
            this.device = { 
                deviceId: qs.get('id'), 
                modelId: qs.get('model-id'), 
                properties: {
                    reported: {},
                    desired: {}
                }}
        },
        async fetchData() {
          
            client.on('error', e => console.error(e))
            client.on('connect', () => {
                console.log('connected', client.connected)
                    client.subscribe(`device/${this.device.deviceId}/tel`)
                    client.subscribe(`registry/${this.device.deviceId}/status`)
                    client.subscribe(`device/${this.device.deviceId}/props`)
                    client.subscribe(`device/${this.device.deviceId}/props/+/ack`)
                    client.subscribe(`device/${this.device.deviceId}/cmd/+/resp`)
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
                const ts = topic.split('/')
                const what = ts[2]
                if (topic === `registry/${this.device.deviceId}/status`) {
                    this.device.connectionState = msg.status === 'online' ? 'Connected' : 'Disconnected'
                    this.device.lastActivityTime = msg.when
                }
                if (topic.startsWith(`device/${this.device.deviceId}/props`)) {
                    const propName = ts[3]
                    if (topic.endsWith('/set')) {
                        const wprop = Properties.decode(message)
                        if (wprop.interval) {
                            this.device.properties.desired[propName] = wprop[propName]
                        }
                    }else if (topic.endsWith('/ack')) {
                        const ackMsg = ack.decode(message)
                        const ackValue = Properties.decode(ackMsg.value.value)
                            this.device.properties.reported[propName] = {ac: ackMsg.status, ad : ackMsg.description, av: 0, value : ackValue[propName] }
                        //gbid('interval_ack').innerText = ackMsg.status + ackMsg.description 
                    } else {
                        const prop = Properties.decode(message)
                        Object.keys(Properties.fields).forEach(k => {
                            const p = this.properties.filter(p => p.name === k)[0]
                            if (p.writable) {
                                if (this.device.properties.reported[k]) {
                                    this.device.properties.reported[k].value = prop[k]
                                } else {
                                    this.device.properties.reported[k] = {value: prop[k], ac:0, ad:''}
                                }

                            } else {
                                 const field = Properties.fields[k]
                                 if (field.type==='google.protobuf.Timestamp') {
                                    this.device.properties.reported[k] = new Date(prop[k].seconds * 1000 + prop[k].nanos/1000)
                                 } else {
                                     this.device.properties.reported[k] =prop[k]
                                 }
                            }
                        })
                    }
                }
                if (topic.startsWith(`device/${this.device.deviceId}/cmd`)) {
                    const cmdName = ts[3]
                    const cmd = this.commands.filter(c => c.name === cmdName)[0]
                    const resType = root.lookupType(cmd.response.name)
                    const resValue = resType.decode(message)
                    const resTypeSecond = Object.keys(resType.fields)[1] // not status
                    cmd.responseMsg = resValue[resTypeSecond]
                }
                if (topic === `device/${this.device.deviceId}/tel`) {
                    const tel = Telemetries.decode(message)
                    Object.keys(Telemetries.fields).forEach(k => {
                        this.telemetryValues[k] = []
                        this.telemetryValues[k].push(tel[k])
                    })
                }
            })

           
        },
        async handlePropUpdate(name, val, schema) {
            const resSchema = resolveSchema(schema)
            //this.device.properties.desired[name] = ''
            //this.device.properties.reported[name] = ''
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
            const prop = {}
            prop[name] = desiredValue
            const msg = Properties.create(prop)
            const payload = Properties.encode(msg).finish()
            client.publish(topic,payload, {qos:1, retain: true})            
        },
        onCommand (cmdName, cmdReq) {
            const topic = `device/${this.device.deviceId}/cmd/${cmdName}`
            const cmd = this.commands.filter(c => c.name === cmdName)[0]
            const reqType = root.lookupType(cmd.request.name)
            const reqTypeFirst = Object.keys(reqType.fields)[0]
            const req = {}
            req[reqTypeFirst] = cmdReq
            const msg = reqType.create(req)
            const payload = reqType.encode(msg).finish()
            client.publish(topic,payload, {qos:1, retain: false})            
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