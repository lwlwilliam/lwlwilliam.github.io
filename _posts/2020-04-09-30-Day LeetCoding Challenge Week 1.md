---
title: 30-Day LeetCoding Challenge Week 1
layout: post
categories: [Leetcode]
keywords: leetcode, Golang
---

> [30-Day LeetCoding Challenge](https://leetcode.com/explore/challenge/card/30-day-leetcoding-challenge/)

<script src="https://cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-AMS-MML_HTMLorMML" type="text/javascript"></script>
<script type="text/x-mathjax-config">
  // 数学公式专用
  MathJax.Hub.Config({
    tex2jax: {
      skipTags: ['script', 'noscript', 'style', 'textarea', 'pre'],
      inlineMath: [['$','$']]
    }
  });
</script>

## April 1st-April 7th

### Single Number

Given a **non-empty** array of integers, every element appears twice except for one. Find that single one.

***Note***

Your algorithm should have a linear runtime complexity. Could you implement it without using extra memory?

#### Example 1

```
Input: [2,2,1]
Output: 1
```

#### Example 2

```
Input: [4,1,2,1,2]
Output: 4
```

#### Answer 1

这是应该是最容易想到的办法了，**但是，不符合 Note 中的追问**。

```go
// 遍历 nums，如果元素不在临时 map 中，则添加进去；如果元素已经存在，则将该元素删除，最后剩下一个没被删除的元素，就是不重复的值。
func singleNumber(nums []int) int {
	tmp := make(map[int]bool)

	for _, v := range nums {
		if _, ok := tmp[v]; !ok {
			tmp[v] = true
		} else {
			delete(tmp, v)
		}
	}

	var ret int
	for k, _ := range tmp {
		ret = k
		break
	}

	return ret
}
```

时间复杂度：$$O(n)$$。遍历 nums 用时 $$O(n)$$，查找 map 是否存在重复元素，用时 $$O(1)$$。

空间复杂度：$$O(n)$$。需要长度为 n 的 map 保存临时元素。

#### Answer 2

这个方法不是我想到的。。。异或操作，真的很巧妙，不过貌似只能用在整型上，另外，重复次数也只能是两次，局限性比较大。

```go
func singleNumber(nums []int) int {
	base := 0
	for _, v := range nums {
		base ^= v
	}

	return base
}
```

时间复杂度：$$O(n)$$。

空间复杂度：$$O(1)$$。

### Counting Elements

Given an integer array arr, count element x such that x + 1 is also in arr.

If there're duplicates in arr, count them seperately.

#### Example 1

```
Input: arr = [1,2,3]
Output: 2
Explanation: 1 and 2 are counted cause 2 and 3 are in arr.
```

#### Example 2

```
Input: arr = [1,1,3,3,5,5,7,7]
Output: 0
Explanation: No numbers are counted, cause there's no 2, 4, 6, or 8 in arr.
```

#### Example 3

```
Input: arr = [1,3,2,3,5,0]
Output: 3
Explanation: 0, 1 and 2 are counted cause 1, 2 and 3 are in arr.
```

#### Example 4

```
Input: arr = [1,1,2,2]
Output: 2
Explanation: Two 1s are counted cause 2 is in arr.
```

***Constraints***
   
*   1 <= arr.length <= 1000
*   0 <= arr[i] <= 1000

***Hint #1***

Use hashset to store all elements.

***Hint #2***

Loop again to count all valid elements.

#### Answer 1

```go
// 先统计出每个元素的个数，再遍历，如果元素+1后仍然存在于 map 中，则计数加上该元素个数
func countElements(arr []int) int {
	m := make(map[int]int)
	for _, v := range arr {
		m[v]++
	}

	count := 0
	for k, v := range m {
		if _, ok := m[k+1]; ok {
			count += v
		}
	}

	return count
}
```