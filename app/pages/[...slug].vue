<script setup lang="ts">
const localePath = useLocalePath();

await navigateTo(localePath('/404'), {
  replace: true,
  redirectCode: 302,
});
</script>
