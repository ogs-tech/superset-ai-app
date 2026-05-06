import { CustomizationListScreen } from '../../components/CustomizationListScreen.js';

export function CommandList(): React.ReactElement {
  return (
    <CustomizationListScreen
      entityType="command"
      templateTargetType="command"
      title="Commands"
      singular="command"
      listMethod="command.list"
      deleteMethod="command.delete"
    />
  );
}
