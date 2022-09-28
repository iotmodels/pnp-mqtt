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
let echoRequest
let echoResponse
let ack
//let getRuntimeStatsRequest
//let getRuntimeStatsResponse

const callEcho = () => {
    const echoReq = gbid('echoReq').value
    const msg = echoRequest.create({inEcho: echoReq})
    const payload = echoRequest.encode(msg).finish()
    const topic = `device/${deviceId}/cmd/echo`
    client.publish(topic, payload, {qos:1, retain:false})
}

const callgetRuntimeStats = () => {
    const echoReq = gbid('getRuntimeStatsReq').value
    const msg =  getRuntimeStatsRequest.create({mode: echoReq})
    const payload = getRuntimeStatsRequest.encode(msg).finish()
    const topic = `device/${deviceId}/cmd/getRuntimeStats`
    client.publish(topic, payload, {qos:1, retain:false})
}

const setWProp = () => {
    const propTextVal = gbid('interval_set').value
    const msg = Properties.create({interval: propTextVal})
    const payload = Properties.encode(msg).finish()
    const topic = `device/${deviceId}/props/interval/set`
    client.publish(topic, payload, {qos:1, retain:true})
}

const start = () => {

    const qs =  new URLSearchParams(window.location.search)
    deviceId = qs.get('id')
    gbid('deviceId').innerText = deviceId

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

 
   protobuf.load('../mqtt-grpc-device.proto')
    .then(function(root) {
        Telemetries = root.lookupType('Telemetries')
        Properties = root.lookupType('Properties')
        //WProperties = root.lookupType('WProperties')
        echoRequest = root.lookupType('echoRequest')
        echoResponse = root.lookupType('echoResponse')
        ack = root.lookupType('ack')
        //getRuntimeStatsRequest = root.lookupType('getRuntimeStatsRequest')
        //getRuntimeStatsResponse = root.lookupType('getRuntimeStatsResponse')
    })
    .catch(e => console.error(e))

    client = mqtt.connect(`${mqttCreds.useTls ? 'wss' : 'ws'}://${mqttCreds.hostName}:${mqttCreds.port}/mqtt`, {
                clientId: mqttCreds.clientId, username: mqttCreds.userName, password: mqttCreds.password })
                client.on('connect', () => {
                    client.subscribe(`device/${deviceId}/tel`)
                    client.subscribe(`device/${deviceId}/props`)
                    client.subscribe(`device/${deviceId}/props/+/ack`)
                    client.subscribe(`device/${deviceId}/cmd/+/resp`)
                })
                
    let i =0
    client.on('message', (topic, message) => {
        console.log(topic)
        const segments = topic.split('/')
        // deviceId = segments[1]
        // if (deviceId) {
        //     gbid('deviceId').innerText = deviceId
        // }
        const what = segments[2]
        if (what === 'tel') {
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
                const wprop = Properties.decode(message)
                if (wprop.interval) {
                    gbid('interval_set').value = wprop.interval
                }
            }else if (topic.endsWith('/ack')) {
                const ackMsg = ack.decode(message)
                gbid('interval_ack').innerText = ackMsg.status + ackMsg.description 
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
        if (what === 'cmd') {
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
