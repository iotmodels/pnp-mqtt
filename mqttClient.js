let mqttCreds
const settings = window.localStorage.getItem('mqttCreds')
if (settings) {
    mqttCreds = JSON.parse(window.localStorage.getItem('mqttCreds'))
} else {
    mqttCreds = {
        hostName: 'test.mosquitto.org',
        port: 8081,
        useTls: true,
        clientId: 'webbrowser' + Date.now(),
        userName: 'no-user',
        password: 'no-password'
    }
    window.localStorage.setItem('mqttCreds', JSON.stringify(mqttCreds))
}
const mqttClient = {
    start: () => mqtt.connect(`${mqttCreds.useTls ? 'wss' : 'ws'}://${mqttCreds.hostName}:${mqttCreds.port}/mqtt`, {
       clientId: mqttCreds.clientId, username: mqttCreds.userName, password: mqttCreds.password })
}

export default mqttClient