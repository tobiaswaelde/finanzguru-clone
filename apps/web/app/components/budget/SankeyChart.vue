<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap justify-between gap-2">
        <h2 class="font-semibold">{{ $t('budget.sankey') }}</h2>
        <div role="group" :aria-label="$t('dashboard.unit')">
          <UButton size="xs" :aria-pressed="unit === 'eur'" @click="unit = 'eur'">€</UButton>
          <UButton size="xs" :aria-pressed="unit === 'pct'" @click="unit = 'pct'">%</UButton>
        </div>
      </div>
    </template>
    <template v-if="graph?.links.length">
      <ClientOnly>
        <VisSingleContainer :data="graph" :height="240">
          <VisSankey :link-value="value" :node-label="label" />
        </VisSingleContainer>
      </ClientOnly>
      <ul class="space-y-1 text-sm">
        <li v-for="link in rootLinks" :key="link.target" class="flex flex-wrap justify-between gap-1">
          <span>{{ nodeNames.get(link.target) }}</span>
          <span>{{
            unit === 'eur' ? formatEur(link.valueCents) : formatPct(total ? link.valueCents / total : 0)
          }}</span>
        </li>
      </ul>
    </template>
    <EmptyState v-else :title="$t('common.notAvailable')" />
  </UCard>
</template>

<script setup lang="ts">
import { formatEur, formatPct, type cashflowSankeySchema } from '@finance/shared';
import { VisSankey, VisSingleContainer } from '@unovis/vue';
import EmptyState from '~/components/common/EmptyState.vue';

type Graph = ReturnType<typeof cashflowSankeySchema.parse>;
type Link = Graph['links'][number];
type Node = Graph['nodes'][number];
const props = defineProps<{ graph: Graph | null }>();
const unit = ref<'eur' | 'pct'>('eur');
const rootLinks = computed(() => props.graph?.links.filter((link) => link.source === 'root') ?? []);
const nodeNames = computed(() => new Map(props.graph?.nodes.map((node) => [node.id, node.label])));
const total = computed(() => rootLinks.value.reduce((sum, link) => sum + link.valueCents, 0));
/** Use cents as the width measure in both unit modes. */
function value(link: Link): number {
  return link.valueCents;
}
/** Use the server-provided localized category name as the label. */
function label(node: Node): string {
  return node.label;
}
</script>
