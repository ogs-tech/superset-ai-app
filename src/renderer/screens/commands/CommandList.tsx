import { CustomizationListScreen } from '../../components/CustomizationListScreen.js';

export function CommandList(): React.ReactElement {
  return (
    <CustomizationListScreen
      entityType="command"
      title="Commands"
      singular="command"
      gender="m"
      listMethod="command.list"
      deleteMethod="command.delete"
    />
  );
}
