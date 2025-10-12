export declare function getGitHubIssueUrl({ title, user, repo, template, body, }: {
    title: string;
    user?: string;
    repo?: string;
    template?: string;
    body?: string;
}): string;
interface IssueOptions {
    error: any;
    cliVersion: string;
    enginesVersion: string;
    command: string;
    prompt: Boolean;
    title?: string;
    reportId?: number;
}
export declare function wouldYouLikeToCreateANewIssue(options: IssueOptions): Promise<void>;
export {};
