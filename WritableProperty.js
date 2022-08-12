export default {
    props: ['deviceProps', 'property', 'schema'],
    emits: ['propUpdated'],
    methods: {
        gv(object, string, defaultValue = '') {
            // https://stackoverflow.com/questions/70283134
            return _.get(object, string, defaultValue)
        },
        getPropColorState(name) {
            const desSet = this.gv(this.deviceProps, 'desired.' + name)
            if (desSet === '') {
                return 'silver'
            } 
            const desVal = this.gv(this.deviceProps, 'desired.' + name)
            const repVal = this.gv(this.deviceProps, 'reported.' + name + '.value')
            return repVal === desVal ? 'lightgreen' : 'lightpink'
        },
        updateProp() {
            const input = document.getElementById('in-' + this.property.name)
            this.$emit('propUpdated', this.property.name, input.value, this.schema)
        },
        formatDate(d) {
            if (d === '0001-01-01T00:00:00Z') return ''
            return moment(d).fromNow()
        }
    },
    template: `
        <div class="prop">
            <span class="prop-name" :title="property.name">{{property.displayName || property.name}}</span>
            <span class="prop-value">{{gv(deviceProps, 'reported.' + property.name + '.value')}}</span>
            desired
            <input size="1" :value="gv(deviceProps, 'desired.' + property.name)" type="text" :id="'in-' + property.name" />
            <button @click="updateProp()">Update</button> 
            <div class="props-metadata" :style="{backgroundColor: getPropColorState(property.name)}">
                <div class="prop-md">
                    <span>status:</span>
                    <span>{{gv(deviceProps, 'reported.' + property.name + '.ac')}}</span>
                </div>
                <div class="prop-md">
                    <span>descr:</span>
                    <span>{{gv(deviceProps, 'reported.' + property.name + '.ad')}}</span>
                </div>
            </div>
            <div class="prop-desc" v-if="property.description">
                {{property.description}}
            </div>
        </div>
    `
}