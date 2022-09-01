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
            console.log('reqqq', this.request)
             this.$emit('commandInvoked', this.command.name, this.request)
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