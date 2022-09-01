
// dupe
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
    data() {
        return {
            request: ''
        }
    },
    props: ['command', 'deviceId', 'responseMsg'],
    emits: ['commandInvoked'],
    methods: {
        async invoke() {
            const reqSchema = resolveSchema(this.command.request.schema)
            let reqValue = {}
            if (reqSchema === 'integer') {
                reqValue = parseInt(this.request)
            } else if (reqSchema === 'boolean') {
                reqValue = new Boolean(this.request)
            } else if (reqSchema === 'string') {
                reqValue = this.request
            }
            this.$emit('commandInvoked', this.command.name, reqValue)
        }
    },
    template: `
        <div :title="command.name">{{command.displayName || command.name}}</div>
        <textarea v-model="request">
        </textarea>
        <br />
        <button @click="invoke()">invoke</button>
        <pre>{{responseMsg}}</pre>
    `
}