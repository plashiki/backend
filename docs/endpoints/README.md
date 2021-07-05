---
sidebarDepth: 2
---
# Endpoints

All endpoints are relative to the base url: `https://plashiki.su/api`

<Endpoint 
    v-for="(ept, i) in data.endpoints"
    :key="i"
    :item="ept"
/>


<script>
import data from '../../spec.json';
export default {
  data: () => ({ data })
}
</script>
