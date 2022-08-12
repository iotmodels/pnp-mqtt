export default {
    data() {
        return {
            request: 2
        }
    },
    props: ['command', 'deviceId', 'responseMsg'],
    emits: ['commandInvoked'],
    methods: {
        async invoke() {
             this.$emit('commandInvoked', this.command.name, parseInt(this.request))
        }
    },
    template: `
        <div :title="command.name">{{command.displayName || command.name}}</div>
        <select v-model="request">
            <option value="0">minimal</option>
            <option value="1">complete</option>
            <option value="2" :selected="request === 2">full</option>
        </select>
        <button @click="invoke()">invoke</button>
        <pre>{{responseMsg}}</pre>
    `
}