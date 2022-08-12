export default {
    props: ['telemetry', 'telemetryValues'],
    template: `
    <table>
        <thead>
            <tr>
                <td>
                 <span :title="telemetry.description">{{telemetry.displayName || telemetry.name}}</span>
                </td>
            </tr>
        </thead>
        <tr v-for="v in telemetryValues">
            <td>{{v[telemetry.name]}} {{telemetry.unit ? telemetry.unit + 's' : ''}}</td>
        </tr>
    </table>
    `
}