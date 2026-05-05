import { EntityList } from '../../components/EntityList.js';

export function CommandList(): React.ReactElement {
  return (
    <EntityList
      entityType="command"
      templateTargetType="command"
      title="Commands"
      singular="command"
      listMethod="command.list"
      deleteMethod="command.delete"
    />
  );
}
