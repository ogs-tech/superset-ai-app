import { CustomizationListScreen } from '../../components/CustomizationListScreen.js';

export function CommandList(): React.ReactElement {
  return (
    <CustomizationListScreen
      entityType="command"
      title="Prompts"
      singular="prompt"
      gender="m"
      subtitle="Prompts reutilizáveis — no Claude Code, são os Commands (slash commands que você dispara com /nome)."
      emptyDescription="Salve um prompt uma vez e dispare quando quiser com /nome. No Claude Code, eles aparecem como Commands."
      listMethod="command.list"
      deleteMethod="command.delete"
    />
  );
}
