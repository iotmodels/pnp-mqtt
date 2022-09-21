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

let Telemetry
let Properties
let echoRequest
let echoResponse

const callEcho = () => {
    const echoReq = gbid('echoReq').value
    const topic = `pnp/${deviceId}/commands/echo`
    const msg = echoRequest.create({inEcho: echoReq})
    const payload = echoRequest.encode(msg).finish()
    client.publish(topic, payload, {qos:1, retain:false})
}

const start = () => {


    const echoBtn = gbid('echoBtn')
    echoBtn.onclick = callEcho


    const el = document.getElementById('chart')
    const data = [] //[{x:1, y:1}, {x:2, y:5}]
    
    let startTime = Date.now();
    const chart = new TimeChart(el, {
        series: [{data, name: 'temperature'}],
        lineWidth: 5,
        //baseTime: startTime
    });

 
   protobuf.load('mqttdevice.proto')
    .then(function(root) {
        Telemetry = root.lookupType('Telemetry')
        Properties = root.lookupType('Properties')
        echoRequest = root.lookupType('echoRequest')
        echoResponse = root.lookupType('echoResponse')
    })
    .catch(e => console.error(e))

    client = mqtt.connect(`${mqttCreds.useTls ? 'wss' : 'ws'}://${mqttCreds.hostName}:${mqttCreds.port}/mqtt`, {
                clientId: mqttCreds.clientId, username: mqttCreds.userName, password: mqttCreds.password })
                client.on('connect', () => {
                    client.subscribe('pnp/+/telemetry')
                    client.subscribe('pnp/+/props/#')
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
            const tel = Telemetry.decode(message)
            data.push({x: i++, y: tel.temperature})
            if (data.length>10) {
                data.shift()
            }
            chart.update()
        }

        if (what === 'props') {
            const prop = Properties.decode(message)
            if (prop.sdkInfo) {
                gbid('sdkInfo').innerText = prop.sdkInfo
            }
            if (prop.started) {
                gbid('started').innerText = new Date(prop.started.seconds * 1000 + prop.started.nanos/1000)
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
