import { CustomizationListScreen } from '../../components/CustomizationListScreen.js';

export function AgentList(): React.ReactElement {
  return (
    <CustomizationListScreen
      entityType="agent"
      templateTargetType="agent"
      title="Agents"
      singular="agent"
      listMethod="agent.list"
      deleteMethod="agent.delete"
    />
  );
}
