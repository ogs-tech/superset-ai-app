import { CustomizationListScreen } from '../../components/CustomizationListScreen.js';

export function ReferenceList(): React.ReactElement {
  return (
    <CustomizationListScreen
      entityType="reference"
      title="References"
      singular="reference"
      listMethod="reference.list"
      deleteMethod="reference.delete"
    />
  );
}
