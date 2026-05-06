import { CustomizationListScreen } from '../../components/CustomizationListScreen.js';

export function SkillList(): React.ReactElement {
  return (
    <CustomizationListScreen
      entityType="skill"
      templateTargetType="skill"
      title="Skills"
      singular="skill"
      listMethod="skill.list"
      deleteMethod="skill.delete"
    />
  );
}
