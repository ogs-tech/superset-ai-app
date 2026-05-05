import { EntityList } from '../customizations/EntityList.js';

export function ReferenceList(): React.ReactElement {
  return (
    <EntityList
      entityType="reference"
      templateTargetType="reference"
      title="References"
      singular="reference"
      listMethod="reference.list"
      deleteMethod="reference.delete"
    />
  );
}
