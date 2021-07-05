# Entities

<Entity
    v-for="(ent, i) in data.entities"
    :key="i"
    :item="ent"
/>

<script>
import data from '../../spec.json';
export default {
  data: () => ({ data })
}
</script>
