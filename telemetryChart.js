const gbid = id => document.getElementById(id)

let mqttCreds = JSON.parse(window.localStorage.getItem('mqttCreds'))
let client
let deviceId

let Telemetries
let Properties
let echoRequest
let echoResponse
let ack
//let getRuntimeStatsRequest
//let getRuntimeStatsResponse

const start = () => {

    const qs =  new URLSearchParams(window.location.search)
    deviceId = qs.get('id')
    gbid('deviceId').innerText = deviceId

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

 
   protobuf.load('mqtt-grpc-device.proto')
    .then(function(root) {
        Telemetries = root.lookupType('Telemetries')
    })
    .catch(e => console.error(e))

    client = mqtt.connect(`${mqttCreds.useTls ? 'wss' : 'ws'}://${mqttCreds.hostName}:${mqttCreds.port}/mqtt`, {
                clientId: mqttCreds.clientId, username: mqttCreds.userName, password: mqttCreds.password })
                client.on('connect', () => {
                    client.subscribe(`device/${deviceId}/tel`)
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
    })
}
window.onload = start
