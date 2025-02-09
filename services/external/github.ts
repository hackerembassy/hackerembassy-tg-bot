import config from "config";

import { GithubConfig } from "@config";

const githubConfig = config.get<GithubConfig>("github");

// Public

export type RepoType = keyof typeof githubConfig.repos;

export function getSpaceIssuesUrl(repoType: RepoType) {
    return getRepoUrl(githubConfig.organization, githubConfig.repos[repoType]) + "/issues";
}

export function newSpaceIssueUrl(repoType: RepoType, title: string, body: string, labels: string[] = ["bug", "bot"]) {
    return newIssueUrl(githubConfig.organization, githubConfig.repos[repoType], title, body, labels);
}

// Internal

function getRepoUrl(owner: string, repo: string) {
    return `https://github.com/${owner}/${repo}`;
}

function newIssueUrl(owner: string, repo: string, title: string, body: string, labels?: string[]) {
    const issueBody = encodeURIComponentSkipCyrillic(body);
    const issueTitle = encodeURIComponentSkipCyrillic(title);
    const issueLabels = labels ? `${encodeURIComponent(labels.join(","))}` : "";
    const repoUrl = getRepoUrl(owner, repo);

    return `${repoUrl}/issues/new?labels=${issueLabels}&title=${issueTitle}&body=${issueBody}`;
}

function encodeURIComponentSkipCyrillic(str: string) {
    return str
        .split("")
        .map(char => (RegExp(/[а-яА-Я]/).exec(char) ? char : encodeURIComponent(char)))
        .join("");
}
