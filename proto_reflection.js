let Telemetries
let Properties
let PropertiesSetter
let Commands

const expandTypes = typeName => {
    if (typeName !== 'string' && typeName !== 'int32' && typeName !== 'double'){

    }
}

window.onload = async () => {
    const root = await protobuf.load('mqttdevice.proto')
        
    const expandTypes = typeName => {
        if (typeName !== 'string' && typeName !== 'int32' && typeName !== 'double'){
            const tInfo = root.lookup(typeName)
            console.log('      ' + tInfo.toString())
        }
    }

    Telemetries = root.lookupType('Telemetries')
    Properties = root.lookupType('Properties')
    PropertiesSetter = root.lookupService('PropertiesSetter')
    Commands = root.lookupService('Commands')

    console.log('Telemetries')
    Object.keys(Telemetries.fields).forEach(k => console.log(Telemetries.fields[k].name + ': ' + Telemetries.fields[k].type))
    console.log(' ')

    console.log('Properties')
    Object.keys(Properties.fields).forEach(k => console.log(Properties.fields[k].name + ': ' + Properties.fields[k].type))
    console.log(' ')

    console.log('Commands')
    Object.keys(Commands.methodsArray).forEach(k => {
        const method = Commands.methodsArray[k]
        console.log(method.name)
        const req = root.lookupType(method.requestType)
        console.log('  req: ' + req.name)
        Object.keys(req.fields)
            .forEach(k => { 
                console.log('    ' + k + ': ' + req.fields[k].type)
                expandTypes(req.fields[k].type)
            })    
        const res = root.lookupType(method.responseType)
        console.log('  res: ')
        Object.keys(res.fields).forEach(k => console.log('    ' + res.fields[k].name + ': ' + res.fields[k].type))    
    })
    console.log(' ')

    console.log('PropertySetters')
    Object.keys(PropertiesSetter.methodsArray).forEach(k => {
        const method = PropertiesSetter.methodsArray[k]
        console.log(method.name)
        const req = root.lookupType(method.requestType)
        console.log('  req: ')
        Object.keys(req.fields)
            .filter(f => f === method.name.substring(4)) // only props by set_ 
            .forEach(k => console.log('    ' + req.fields[k].name + ': ' + req.fields[k].type))    
        const res = root.lookupType(method.responseType)
        console.log('  res: ' + res.name)
        Object.keys(res.fields).forEach(k => console.log('    ' + res.fields[k].name + ': ' + res.fields[k].type))    
    })
   
}