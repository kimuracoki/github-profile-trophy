import { soxa } from "../../deps.ts";
import {
  EServiceKindError,
  GithubError,
  GithubErrorResponse,
  GithubExceedError,
  QueryDefaultResponse,
  ServiceError,
} from "../Types/index.ts";
import { Logger } from "../Helpers/Logger.ts";

export async function requestGithubData<T = unknown>(
  query: string,
  variables: { [key: string]: string },
  token = "",
) {
  const response = await soxa.post("", {}, {
    data: { query, variables },
    headers: {
      Authorization: `bearer ${token}`,
    },
  }) as QueryDefaultResponse<{ user: T }>;
  const responseData = response.data;

  if (responseData?.data?.user) {
    if (responseData.errors?.length) {
      // Partial response: surface GraphQL errors (e.g. missing token scopes)
      Logger.warn(JSON.stringify(responseData.errors, null, 2));
    }
    return responseData.data.user;
  }

  throw handleError(responseData);
}

function handleError(
  responseData: {
    data?: unknown;
    errors?: GithubError[];
    message?: string;
    documentation_url?: string;
  },
): ServiceError {
  let isRateLimitExceeded = false;
  const arrayErrors = responseData?.errors || [];

  if (Array.isArray(arrayErrors) && arrayErrors.length > 0) {
    isRateLimitExceeded = arrayErrors.some((error) =>
      error.type.includes(EServiceKindError.RATE_LIMIT)
    );
  }

  if (responseData?.message) {
    isRateLimitExceeded = responseData.message.toLowerCase().includes(
      "rate limit",
    );
  }

  if (isRateLimitExceeded) {
    throw new ServiceError(
      "Rate limit exceeded",
      EServiceKindError.RATE_LIMIT,
    );
  }

  throw new ServiceError(
    "unknown error",
    EServiceKindError.NOT_FOUND,
  );
}
