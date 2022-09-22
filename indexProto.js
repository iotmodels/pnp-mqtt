const gbid = id => document.getElementById(id)

const mqttCreds = {
    hostName: 'localhost',
    port: 8080,
    useTls: false,
    clientId: 'webbrowser' + Date.now(),
    userName: 'user',
    password: 'password'
}
let client
let deviceId

let Telemetries
let Properties
let WProperties
let echoRequest
let echoResponse

const callEcho = () => {
    const echoReq = gbid('echoReq').value
    const msg = echoRequest.create({inEcho: echoReq})
    const payload = echoRequest.encode(msg).finish()
    const topic = `pnp/${deviceId}/commands/echo`
    client.publish(topic, payload, {qos:1, retain:false})
}

const setWProp = () => {
    const propTextVal = gbid('interval_set').value
    const msg = WProperties.create({interval: propTextVal})
    const payload = WProperties.encode(msg).finish()
    const topic = `pnp/${deviceId}/props/interval/set`
    client.publish(topic, payload, {qos:1, retain:true})
}

const start = () => {

    const echoBtn = gbid('echoBtn')
    echoBtn.onclick = callEcho

    const intervalBtn = gbid('intervalBtn')
    intervalBtn.onclick = setWProp


    const el = document.getElementById('chart')
    const data = [] 
    
    let startTime = Date.now();
    const chart = new TimeChart(el, {
        series: [{data, name: 'temperature'}],
        lineWidth: 5,
        //baseTime: startTime
    });

 
   protobuf.load('mqttdevice.proto')
    .then(function(root) {
        Telemetries = root.lookupType('Telemetries')
        Properties = root.lookupType('Properties')
        WProperties = root.lookupType('WProperties')
        echoRequest = root.lookupType('echoRequest')
        echoResponse = root.lookupType('echoResponse')
    })
    .catch(e => console.error(e))

    client = mqtt.connect(`${mqttCreds.useTls ? 'wss' : 'ws'}://${mqttCreds.hostName}:${mqttCreds.port}/mqtt`, {
                clientId: mqttCreds.clientId, username: mqttCreds.userName, password: mqttCreds.password })
                client.on('connect', () => {
                    client.subscribe('pnp/+/telemetry')
                    client.subscribe('pnp/+/props/+')
                    client.subscribe('pnp/+/commands/echo/resp/+')
                })
                
    let i =0
    client.on('message', (topic, message) => {
        const segments = topic.split('/')
        deviceId = segments[1]
        if (deviceId) {
            gbid('deviceId').innerText = deviceId
        }
        const what = segments[2]
        if (what === 'telemetry') {
            const tel = Telemetries.decode(message)
            data.push({x: i++, y: tel.temperature})
            if (data.length>10) {
                data.shift()
            }
            chart.update()
        }

        if (what === 'props') {
            if (topic.endsWith('/set')) {
                const wprop = WProperties.decode(message)
                if (wprop.interval) {
                    gdbi('interval_set').value = wprop.interval
                }
            } else {
                const prop = Properties.decode(message)
                if (prop.sdkInfo) {
                    gbid('sdkInfo').innerText = prop.sdkInfo
                }
                if (prop.started) {
                    gbid('started').innerText = new Date(prop.started.seconds * 1000 + prop.started.nanos/1000)
                }
                if (prop.interval) {
                    gbid('interval').innerText = prop.interval
                }
            }
        }

        if (what === 'commands') {
            const cmdName = segments[3]
            const respValue = echoResponse.decode(message)
            gbid('echoResp').innerText = respValue.outEcho
        }
    })
}
window.onload = start
