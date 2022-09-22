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
let getRuntimeStatsRequest
let getRuntimeStatsResponse

const callEcho = () => {
    const echoReq = gbid('echoReq').value
    const msg = echoRequest.create({inEcho: echoReq})
    const payload = echoRequest.encode(msg).finish()
    const topic = `pnp/${deviceId}/commands/echo`
    client.publish(topic, payload, {qos:1, retain:false})
}

const callgetRuntimeStats = () => {
    const echoReq = gbid('getRuntimeStatsReq').value
    const msg =  getRuntimeStatsRequest.create({mode: echoReq})
    const payload = getRuntimeStatsRequest.encode(msg).finish()
    const topic = `pnp/${deviceId}/commands/getRuntimeStats`
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

    const getRuntimeStatsBtn = gbid('getRuntimeStatsBtn')
    getRuntimeStatsBtn.onclick = callgetRuntimeStats

    const intervalBtn = gbid('intervalBtn')
    intervalBtn.onclick = setWProp


    const el = document.getElementById('chart')
    const dataTemperature = [] 
    const dataWorkingSet = []
    let startTime = Date.now();
    const chart = new TimeChart(el, {
        series: [
            {data: dataTemperature, name: 'temperature'},
            {data: dataWorkingSet, name: 'workingSet', color: 'red'}
        ],
        lineWidth: 5
        //baseTime: startTime
    });

 
   protobuf.load('mqttdevice.proto')
    .then(function(root) {
        Telemetries = root.lookupType('Telemetries')
        Properties = root.lookupType('Properties')
        WProperties = root.lookupType('WProperties')
        echoRequest = root.lookupType('echoRequest')
        echoResponse = root.lookupType('echoResponse')
        getRuntimeStatsRequest = root.lookupType('getRuntimeStatsRequest')
        getRuntimeStatsResponse = root.lookupType('getRuntimeStatsResponse')
    })
    .catch(e => console.error(e))

    client = mqtt.connect(`${mqttCreds.useTls ? 'wss' : 'ws'}://${mqttCreds.hostName}:${mqttCreds.port}/mqtt`, {
                clientId: mqttCreds.clientId, username: mqttCreds.userName, password: mqttCreds.password })
                client.on('connect', () => {
                    client.subscribe('pnp/+/telemetry')
                    client.subscribe('pnp/+/props/+')
                    client.subscribe('pnp/+/commands/+/resp/+')
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
            if (tel.temperature) {
                dataTemperature.push({x: i++, y: tel.temperature})
                // if (dataTemperature.length>100) {
                //     dataTemperature.shift()
                // }
            }
            if (tel.workingSet) {
                dataWorkingSet.push({x:i, y: tel.workingSet / 2000000 })
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
            if (cmdName === 'echo') {
                const respValue = echoResponse.decode(message)
                gbid('echoResp').innerText = respValue.outEcho
            }
            if (cmdName === 'getRuntimeStats') {
                const respValue = getRuntimeStatsResponse.decode(message)
                gbid('getRuntimeStatsResp').innerText = JSON.stringify(respValue.diagResults, null, 2)
            }
        }
    })
}
window.onload = start
