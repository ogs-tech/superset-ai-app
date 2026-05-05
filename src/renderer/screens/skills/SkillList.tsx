import { EntityList } from '../../components/EntityList.js';

export function SkillList(): React.ReactElement {
  return (
    <EntityList
      entityType="skill"
      templateTargetType="skill"
      title="Skills"
      singular="skill"
      listMethod="skill.list"
      deleteMethod="skill.delete"
    />
  );
}
