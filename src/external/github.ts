import fetchRetry from '@/helpers/fetch-retry'
import { github } from '@/config'

export class GithubApiError extends Error {
}

export interface GithubFile {
    name: string
    path: string
    sha: string
    size: number
    url: string
    html_url: string
    git_url: string
    download_url: string
    type: string
    content: string
    encoding: string
}

export interface GithubUpdateFileBody {
    message: string
    content: string
    sha?: string
    branch?: string
    committer?: string
    author?: string
}

export function getGithubFile (repo: string, path: string): Promise<GithubFile | null> {
    return fetchRetry(`https://api.github.com/repos/${repo}/contents/${path}`, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'bearer ' + github.token
        }
    }).then(i => {
        if (i.status !== 200) return null

        return i.json().then((file) => {
            file.content = Buffer.from(file.content, 'base64').toString('utf-8')

            return file
        })
    })
}

export function updateGithubFile (repo: string, path: string, params: GithubUpdateFileBody): Promise<void> {
    params.content = Buffer.from(params.content, 'utf-8').toString('base64')
    return fetchRetry(`https://api.github.com/repos/${repo}/contents/${path}`, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'bearer ' + github.token
        },
        method: 'PUT',
        body: JSON.stringify(params)
    }).then(i => {
        if (i.status !== 200) throw new GithubApiError(`${i.status} (${i.statusText})`)
    })
}

export async function appendToGithubFile (repo: string, path: string, data: string): Promise<void> {
    const file = await getGithubFile(repo, path)
    let content = file?.content ?? ''
    await updateGithubFile(repo, path, {
        message: 'update',
        sha: file?.sha,
        content: content + data
    })
}
