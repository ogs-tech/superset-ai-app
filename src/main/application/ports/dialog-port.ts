export interface SelectFolderParams {
  defaultPath?: string;
}

export interface SelectFolderResult {
  canceled: boolean;
  path?: string;
}

export interface DialogPort {
  selectFolder(params: SelectFolderParams): Promise<SelectFolderResult>;
}
