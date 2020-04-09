---
title: 30-Day LeetCoding Challenge Week 2
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

## April 8th-April 14th

### Middle of the Linked List

Given a non-empty, singly linked list with head node head, return a middle node of linked list.

If there are two middle nodes, return the second middle node.

#### Example 1

```
Input: [1,2,3,4,5]
Output: Node 3 from this list (Serialization: [3,4,5])
The returned node has value 3.  (The judge's serialization of this node is [3,4,5]).
Note that we returned a ListNode object ans, such that:
ans.val = 3, ans.next.val = 4, ans.next.next.val = 5, and ans.next.next.next = NULL.
```

#### Example 2

```
Input: [1,2,3,4,5,6]
Output: Node 4 from this list (Serialization: [4,5,6])
Since the list has two middle nodes with values 3 and 4, we return the second one.
```

***Note***
 
The number of nodes in the given list will be between 1 and 100.

#### Answer 1

```go
/**
 * Definition for singly-linked list.
 * type ListNode struct {
 *     Val int
 *     Next *ListNode
 * }
 */
func middleNode(head *ListNode) *ListNode {
	mi := middleIndex(head)
	cur := head
	for i := 1; i <= mi; i++ {
		cur = cur.Next
	}

	return cur
}

func middleIndex(head *ListNode) int {
	cur := head
	count := 0
	for cur != nil {
		count++
		cur = cur.Next
	}

	if count < 2 {
		return 0
	}

	return count / 2
}
```

时间复杂度：$$O(n)$$。

空间复杂度：$$O(n)$$。

### Backspace String Compare

Given two strings S and T, return if they are equal when both are typed into empty text editors. `#` means a backspace character.

#### Example 1

```
Input: S = "ab#c", T = "ad#c"
Output: true
Explanation: Both S and T become "ac".
```

#### Example 2

```
Input: S = "ab##", T = "c#d#"
Output: true
Explanation: Both S and T become "".
```

#### Example 3

```
Input: S = "a##c", T = "#a#c"
Output: true
Explanation: Both S and T become "c".
```

#### Example 4

```
Input: S = "a#c", T = "b"
Output: false
Explanation: S becomes "c" while T becomes "b".
```

***Note***

```
1 <= S.length <= 200
1 <= T.length <= 200
S and T only contain lowercase letters and '#' characters.
```

***Follow up***

Can you solve it in O(N) time and O(1) space?

#### Answer 1

```go
func backspaceCompare(S string, T string) bool {
	if helper(S) == helper(T) {
		return true
	}

	return false
}

func helper(s string) string {
	sli := make([]rune, 0)
	for _, v := range s {
		if v != '#' {
			sli = append(sli, v)
		} else if len(sli) != 0 {
			sli = sli[:len(sli)-1]
		}
	}

	return string(sli)
}
```
