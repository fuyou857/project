import type { UiSelectOption } from './SearchableSelect';

export function projectSelectOptions(
  projects: { id: string; name: string }[],
  emptyLabel = '选择项目',
): UiSelectOption[] {
  return [{ value: '', label: emptyLabel }, ...projects.map(p => ({ value: p.id, label: p.name }))];
}

export function contractSelectOptions(
  contracts: { id: string; contract_name: string; contract_code?: string }[],
  emptyLabel: string,
  labelStyle: 'nameCode' | 'nameOnly' = 'nameCode',
): UiSelectOption[] {
  return [
    { value: '', label: emptyLabel },
    ...contracts.map(c => ({
      value: c.id,
      label:
        labelStyle === 'nameOnly' || !c.contract_code
          ? c.contract_name
          : `${c.contract_name} (${c.contract_code})`,
    })),
  ];
}

export function optionsFromTuples(items: readonly { value: string; label: string }[]): UiSelectOption[] {
  return items.map(i => ({ value: i.value, label: i.label }));
}
