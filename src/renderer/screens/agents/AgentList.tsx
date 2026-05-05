import { EntityList } from '../../components/EntityList.js';

export function AgentList(): React.ReactElement {
  return (
    <EntityList
      entityType="agent"
      templateTargetType="agent"
      title="Agents"
      singular="agent"
      listMethod="agent.list"
      deleteMethod="agent.delete"
    />
  );
}
