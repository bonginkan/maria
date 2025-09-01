/**
 * OpenAI Responses API プロバイダー
 * Temperature를 사용하지 않고 reasoning.effort / text.verbosity로 제어
 */

export type ResponsesOptions = {
  model: string;
  input: string | any; // string or array of content parts
  reasoning?: { effort?: "minimal" | "medium" | "high" };
  text?: { verbosity?: "low" | "medium" | "high" };
  max_output_tokens?: number;
  response_format?:
    | { type: "json_object" }
    | { type: "json_schema"; json_schema: any };
  tools?: any[]; // functions / web_search / mcp など
  tool_choice?: any; // allowed_tools など
  previous_response_id?: string; // CoT継続
};

export type ResponsesResult = {
  output_text: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  raw: any;
};

export class OpenAIResponses {
  constructor() {
    // Constructor implementation
  }

  async create(opts: ResponsesOptions): Promise<ResponsesResult> {
    const body: any = {
      model: opts.model,
      input: opts.input,
      max_output_tokens:
        opts.max_output_tokens ??
        Number(process.env.OPENAI_MAX_OUTPUT_TOKENS ?? 2048),
    };

    // Responses API 전용 파라미터들 (temperature 없음)
    if (opts.reasoning) {
      body.reasoning = opts.reasoning;
    }

    if (opts.text) {
      body.text = opts.text;
    }

    if (opts.response_format) {
      body.response_format = opts.response_format;
    }

    if (opts.tools && opts.tools.length > 0) {
      body.tools = opts.tools;
    }

    if (opts.tool_choice) {
      body.tool_choice = opts.tool_choice;
    }

    if (opts.previous_response_id) {
      body.previous_response_id = opts.previous_response_id;
    }

    try {
      const response = await fetch(`${this.base}/responses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI Responses ${response.status}: ${errorText}`);
      }

      const json = await response.json();

      // 대표 출력 추출 (Responses API는 output_text가 편의상 준비됨)
      const output_text =
        json.output_text ?? json.choices?.[0]?.message?.content ?? "";
      const usage = json.usage ?? {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      };

      return {
        output_text,
        usage,
        raw: json,
      };
    } catch (error) {
      console.error("OpenAI Responses API 오류:", error);
      throw error;
    }
  }

  /**
   * 스트리밍 지원 (향후 확장용)
   */
  async *createStream(opts: ResponsesOptions): AsyncGenerator<string> {
    // 스트리밍 구현은 나중에 필요시 추가
    const result = await this.create(opts);
    yield result.output_text;
  }

  /**
   * 배치 처리 지원 (향후 확장용)
   */
  async createBatch(requests: ResponsesOptions[]): Promise<ResponsesResult[]> {
    // 배치 처리 구현은 나중에 필요시 추가
    return Promise.all(requests.map((req) => this.create(req)));
  }
}

// 팩토리 함수
export function createOpenAIResponses(): OpenAIResponses {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for Responses API");
  }

  return new OpenAIResponses(apiKey);
}

export default OpenAIResponses;
