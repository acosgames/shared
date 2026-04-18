declare const octokit: import("@octokit/core").Octokit & {
    paginate: import("@octokit/plugin-paginate-rest").PaginateInterface;
} & import("@octokit/plugin-rest-endpoint-methods/dist-types/generated/method-types.js").RestEndpointMethods & import("@octokit/plugin-rest-endpoint-methods").Api;
export default octokit;
//# sourceMappingURL=github.d.ts.map