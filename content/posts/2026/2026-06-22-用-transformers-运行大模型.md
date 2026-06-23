---
date: 2026-06-22
title: 用 transformers 运行大模型
categories: [AI]
keywords: [AI,大模型,python,transformers]
---

`Hugging Face`的`transformers`库是目前最主流的大模型推理框架之一，几行代码就能在本地跑起一个对话模型。本文将使用`Qwen/Qwen3.5-0.8B`这个小模型作为示例，整个流程分为三步：安装依赖、下载模型、运行推理。

### 下载依赖

首先安装必要的`Python`包。`transformers`负责模型加载与推理，`torch`是底层计算框架，`modelscope`则提供国内更快的模型下载通道。

```bash
$ pip install transformers torch modelscope
```

### 从 modelscope 下载大模型镜像

直接从`Hugging Face`拉取模型有时会比较慢，这里通过`modelscope`的`snapshot_download`下载，并指定到`huggingface`的缓存目录以便后续加载。

```python
from modelscope import snapshot_download
snapshot_download(model_id='Qwen/Qwen3.5-0.8B', cache_dir='/home/go/.cache/huggingface/hub')
```

### 运行大模型

下载完成后，使用`transformers`加载模型和分词器。`AutoModelForCausalLM`是因果语言模型的通用入口，能自动匹配`Qwen`的架构；`torch_dtype='auto'`会让框架根据模型配置自动选择合适的精度。

```python
from transformers import AutoModelForCausalLM, AutoTokenizer

model_id = '/home/go/.cache/huggingface/hub/Qwen/Qwen3.5-0.8B'
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    torch_dtype='auto',
    trust_remote_code=True
)

tn = AutoTokenizer.from_pretrained(model_id)

prompt = ('"平静"的英文是什么？')

input_ids = tn.encode(prompt, return_tensors='pt')

generation_output = model.generate(
    input_ids=input_ids,
    max_new_tokens=10000
)

print(tn.decode(generation_output[0]))
```

就这样，一个最简的大模型本地推理就完成了。当然，这只是一个起点——实际项目中还可以进一步配置`temperature`、`top_p`等生成参数，或者用`pipeline`的`API`进一步简化调用。
