'use client'
import { fetchEventSource, EventStreamContentType, EventSourceMessage } from '@microsoft/fetch-event-source';
import { ChatOptions, LLMApi, LLMModel, LLMUsage, RequestMessage, ResponseContent } from '@/app/adapter/interface';
import { prettyObject } from '@/app/utils';
import { InvalidAPIKeyError, TimeoutError } from '@/app/adapter/errorTypes';
import { callMCPTool } from '@/app/utils/mcpToolsServer';
import { mcpToolsToOpenAITools, openAIToolsToMcpTool } from '@/app/utils/mcpToolsClient';
import {
  ChatCompletionMessageToolCall,
  ChatCompletionToolMessageParam,
  ChatCompletionAssistantMessageParam,
  ChatCompletionContentPartText,
  ChatCompletionMessageParam,
} from 'openai/resources';

export default class ChatGPTApi implements LLMApi {
  private providerId: string;
  constructor(providerId: string = 'openai') {
    this.providerId = providerId;
  }
  private controller: AbortController | null = null;
  private answer = '';
  private reasoning_content = '';
  private finishReason = '';
  private finished = false;
  private isThinking = false;

  /**
   * Clean the tool call arguments
   * @param toolCall - The tool call
   * @returns The cleaned tool call
   */
  private cleanToolCallArgs(toolCall: ChatCompletionMessageToolCall): ChatCompletionMessageToolCall {
    if (toolCall.function.arguments) {
      let args = toolCall.function.arguments
      const codeBlockRegex = /```(?:\w*\n)?([\s\S]*?)```/
      const match = args.match(codeBlockRegex)
      if (match) {
        // Extract content from code block
        let extractedArgs = match[1].trim()
        // Clean function call format like tool_call(name1=value1,name2=value2)
        const functionCallRegex = /^\s*\w+\s*\(([\s\S]*?)\)\s*$/
        const functionMatch = extractedArgs.match(functionCallRegex)
        if (functionMatch) {
          // Try to convert parameters to JSON format
          const params = functionMatch[1].split(',').filter(Boolean)
          // const paramsObj = {}
          const paramsObj: { [key: string]: any } = {}; // 显式定义索引签名
          params.forEach((param) => {
            const [name, value] = param.split('=').map((p) => p.trim())
            if (name && value !== undefined) {
              paramsObj[name] = value
            }
          })
          extractedArgs = JSON.stringify(paramsObj)
        }
        toolCall.function.arguments = extractedArgs
      }
      args = toolCall.function.arguments
      const firstBraceIndex = args.indexOf('{')
      const lastBraceIndex = args.lastIndexOf('}')
      if (firstBraceIndex !== -1 && lastBraceIndex !== -1 && firstBraceIndex < lastBraceIndex) {
        toolCall.function.arguments = args.substring(firstBraceIndex, lastBraceIndex + 1)
      }
    }
    return toolCall
  }

  prepareMessage<ChatCompletionMessageParam>(messages: RequestMessage[]): ChatCompletionMessageParam[] {
    return messages.map(msg => {
      // 处理文本消息
      if (typeof msg.content === 'string') {
        return {
          role: msg.role,
          content: msg.content
        } as ChatCompletionMessageParam;
      }

      // 处理包含图像的消息
      if (Array.isArray(msg.content)) {
        const formattedContent = msg.content.map(item => {
          if (item.type === 'text') {
            return {
              type: 'text',
              text: item.text
            };
          }
          if (item.type === 'image') {
            return {
              type: 'image_url',
              image_url: {
                url: item.data,
              }
            };
          }
        }).filter(Boolean);

        return {
          role: msg.role,
          content: formattedContent
        } as ChatCompletionMessageParam;
      }

      // 默认返回文本消息
      return {
        role: msg.role,
        content: ''
      } as ChatCompletionMessageParam;
    });
  }

  async chat(options: ChatOptions) {
    this.answer = '';
    this.reasoning_content = '';
    const clear = () => {
      if (!this.finished) {
        this.finished = true;
        if (this.controller) {
          this.controller.abort();
          this.controller = null;
        }
        this.answer = '';
        this.reasoning_content = '';
      }
    };
    this.controller = new AbortController();

    const timeoutId = setTimeout(() => {
      this.controller?.abort('timeout');
      options.onError?.(new TimeoutError('Timeout'));
    }, 30000);

    const messages: ChatCompletionMessageParam[] = this.prepareMessage(options.messages)
    let toolsParameter = {};

    const processOnMessage = async (event: EventSourceMessage) => {
      if (event.data === "[DONE]") {
        // 调用工具时，第一步 content 没内容返回，无需新增一条消息
        if (this.answer) {
          options.onFinish({
            content: this.answer,
            reasoning_content: this.reasoning_content,
          });
        }
        clear();
        return;
      }
      const text = event.data;
      try {
        const json = JSON.parse(text);
        if (json.choices.length === 0) {
          return;
        }
        const delta = json?.choices[0]?.delta;
        const finishReason = json.choices[0]?.finish_reason

        // 拼接 toolCall 参数
        if (delta?.tool_calls) {
          const chunkToolCalls = delta.tool_calls
          for (const t of chunkToolCalls) {
            const { index, id, function: fn, type } = t
            const args = fn && typeof fn.arguments === 'string' ? fn.arguments : ''
            if (!(index in final_tool_calls)) {
              final_tool_calls[index] = {
                id,
                function: {
                  name: fn?.name,
                  arguments: args
                },
                type
              } as ChatCompletionMessageToolCall
            } else {
              final_tool_calls[index].function.arguments += args
            }
          }
        }

        // 结束时，如果有 tool_calls 则分别处理
        if (finishReason === 'tool_calls') {
          this.finishReason = 'tool_calls';
          // 需要循环调用 tools 再把获取的结果给到大模型
          const toolCalls = Object.values(final_tool_calls).map(this.cleanToolCallArgs);
          messages.push({
            role: 'assistant',
            tool_calls: toolCalls
          } as ChatCompletionAssistantMessageParam);
          for (const toolCall of toolCalls) {
            const mcpTool = openAIToolsToMcpTool(options.mcpTools, toolCall);
            if (!mcpTool) {
              continue;
            }
            // toolCalls 包含了大模型返回的提取的参数
            const toolCallResponse = await callMCPTool(mcpTool);
            const toolResponsContent: Array<ChatCompletionContentPartText | string> = [];
            for (const content of toolCallResponse.content) {
              if (content.type === 'text') {
                toolResponsContent.push({
                  type: 'text',
                  text: content.text
                })
              }
              else {
                console.warn('Unsupported content type:', content.type)
                toolResponsContent.push({
                  type: 'text',
                  text: 'unsupported content type: ' + content.type
                })
              }
            }


            if (options.config.model.toLocaleLowerCase().includes('gpt')) {
              messages.push({
                role: 'tool',
                content: toolResponsContent,
                tool_call_id: toolCall.id
              } as ChatCompletionToolMessageParam)
            } else {
              messages.push({
                role: 'tool',
                content: JSON.stringify(toolResponsContent),
                tool_call_id: toolCall.id
              } as ChatCompletionToolMessageParam)
            }

            //call tool request
            try {
              await fetchEventSource('/api/completions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Provider': this.providerId,
                  'X-Chat-Id': options.chatId!,
                },
                body: JSON.stringify({
                  "stream": true,
                  "model": `${options.config.model}`,
                  "messages": messages,
                  "stream_options": {
                    "include_usage": true
                  }
                }),
                onopen: async (res) => {
                  clearTimeout(timeoutId);
                  this.finished = false;
                  if (
                    !res.ok ||
                    !res.headers.get("content-type")?.startsWith(EventStreamContentType) ||
                    res.status !== 200
                  ) {
                    let resTextRaw = '';
                    try {
                      const resTextJson = await res.clone().json();
                      resTextRaw = prettyObject(resTextJson);
                    } catch {
                      resTextRaw = await res.clone().text();
                    }
                    const responseTexts = [resTextRaw];
                    if (res.status === 401) {
                      options.onError?.(new InvalidAPIKeyError('Invalid API Key'));
                    } else {
                      this.answer = responseTexts.join("\n\n");
                      options.onError?.(new Error(this.answer));
                    }
                    clear();
                  }
                },
                onmessage: processOnMessage,
                onclose: () => {
                  clear();
                },
                onerror: (err) => {
                  this.controller = null;
                  this.finished = true;
                  this.answer = '';
                  throw err;
                },
                openWhenHidden: true,

              })
            } catch (e) { }
            //call tool request end------
          }
        }
        //------------end-of-toolCall----------

        const deltaContent = delta?.content;
        const deltaReasoningContent = delta?.reasoning_content;
        if (deltaReasoningContent) {
          this.reasoning_content += deltaReasoningContent;
        }
        if (deltaContent) {
          if (!this.isThinking) {
            if (deltaContent.startsWith("<think>")) {
              this.isThinking = true;
              const thinkContent = deltaContent.slice(7).trim();
              if (thinkContent) {
                this.reasoning_content += thinkContent;
              }
            } else {
              this.answer += deltaContent;
            }
          } else {
            if (deltaContent.endsWith("</think>")) {
              this.isThinking = false;
              const thinkContent = deltaContent.slice(0, -8).trim();
              if (thinkContent) {
                this.reasoning_content += thinkContent;
              }
            } else {
              if (deltaContent.trim()) {
                this.reasoning_content += deltaContent;
              }
            }
          }
        }
        options.onUpdate({
          content: this.answer,
          reasoning_content: this.reasoning_content,
        });
      } catch (e) {
        console.error("[Request] parse error", text, event);
      }
    }

    if (options.mcpTools) {
      const tools = mcpToolsToOpenAITools(options.mcpTools);
      if (tools.length > 0) {
        toolsParameter = {
          tools,
          tool_choice: "auto",
        }
      }
    }
    const final_tool_calls = {} as Record<number, ChatCompletionMessageToolCall>
    try {
      await fetchEventSource('/api/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Provider': this.providerId,
          'X-Chat-Id': options.chatId!,
        },
        body: JSON.stringify({
          "stream": true,
          "model": `${options.config.model}`,
          "messages": messages,
          "stream_options": {
            "include_usage": true
          },
          ...toolsParameter
        }),
        signal: this.controller.signal,
        onopen: async (res) => {
          clearTimeout(timeoutId);
          this.finished = false;
          if (
            !res.ok ||
            !res.headers.get("content-type")?.startsWith(EventStreamContentType) ||
            res.status !== 200
          ) {

            let resTextRaw = '';
            try {
              const resTextJson = await res.clone().json();
              resTextRaw = prettyObject(resTextJson);
            } catch {
              resTextRaw = await res.clone().text();
            }
            const responseTexts = [resTextRaw];
            if (res.status === 401) {
              options.onError?.(new InvalidAPIKeyError('Invalid API Key'));
            } else {
              this.answer = responseTexts.join("\n\n");
              options.onError?.(new Error(this.answer));
            }
            clear();
          }
        },
        onmessage: processOnMessage,
        onclose: () => {
          clear();
        },
        onerror: (err) => {
          this.controller = null;
          this.finished = true;
          this.answer = '';
          // 需要 throw，不然框架会自动重试
          throw err;
        },
        openWhenHidden: true,
      });
    } catch (error) {
      if (error instanceof Error) {
        options.onError?.(new InvalidAPIKeyError('Invalid API Key'));
      } else {
        options.onError?.(new Error('An unknown error occurred'));
      }
      clear();
    } finally {
      clearTimeout(timeoutId);
    }
  }
  stopChat = (callback: (responseContent: ResponseContent) => void) => {
    this.finished = true;
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
    callback({
      content: this.answer,
      reasoning_content: this.reasoning_content
    });
    this.answer = '';
    this.reasoning_content = '';
  }

  async check(modelId: string, apikey: string, apiUrl: string): Promise<{ status: 'success' | 'error', message?: string }> {
    const headers = {
      'Content-Type': 'application/json',
      'X-Apikey': `${apikey}`,
      'X-Provider': this.providerId,
      'X-Endpoint': apiUrl
    };
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch('/api/completions', {
        signal: controller.signal,
        method: 'POST',
        headers,
        body: JSON.stringify({
          "stream": true,
          "model": modelId,
          "messages": [{
            "role": "user",
            "content": "hello"
          }],
        }),
      });
      if (!res.ok) {
        let resTextRaw = '';
        try {
          const resTextJson = await res.clone().json();
          resTextRaw = prettyObject(resTextJson);
        } catch {
          resTextRaw = await res.clone().text();
        }
        return {
          status: 'error',
          message: resTextRaw,
        }
      } else {
        clearTimeout(timeoutId);
        return {
          status: 'success'
        }
      }
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') {
        return {
          status: 'error',
          message: '网络连接超时',
        }
      }
      return {
        status: 'error',
        message: (error as Error)?.message || 'Unknown error occurred',
      }
    }
  }
  usage(): Promise<LLMUsage> {
    throw new Error('Method not implemented.');
  }

  models(): Promise<LLMModel[]> {
    throw new Error('Method not implemented.');
  }

}
