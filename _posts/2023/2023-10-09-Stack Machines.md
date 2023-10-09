---
title: Stack Machines
layout: post
categories: [编译原理]
keywords: PHP,Stack Machines
---

`Stack Machines`，感觉不翻译看起来会顺眼一点，翻译成`栈机`感觉怪怪的。该文章总结自`Igor Wiedler`的`Stack Machines`系列文章，可惜他很久没贡献过代码以及没更新过博客了。先贴代码，到时候再写文章，可能需要一段时间来消化这个系列。

```php
<?php

function execute(array $ops)
{
    $labels = [];

    foreach ($ops as $ip => $op) {
        if (preg_match('/^label\((.+)\)$/', $op, $match)) {
            $label = $match[1];
            $labels[$label] = $ip;
        }
    }

    $stack = new SplStack();
    for ($ip = 0; $ip < count($ops); $ip++) {
        $op = $ops[$ip];

        if (is_numeric($op)) {
            $stack->push((int)$op);
            continue;
        }

        // 格式：label(main)，名为 main 的标签
        // 移到上面，防止 jmp 找不到 对应的 $labels[$label];
        if (preg_match('/^label\((.+)\)$/', $op, $match)) {
//            $label = $match[1];
//            $labels[$label] = $ip;
            continue;
        }

        // 格式：jmp(main)，跳转到 main 标签
        if (preg_match('/^jmp\((.+)\)$/', $op, $match)) {
            $label = $match[1];
            $ip = $labels[$label];
            continue;
        }

        // 格式：jz(main)，如果栈顶元素为 0，则跳转到 main 标签
        if (preg_match('/^jz\((.+)\)$/', $op, $match)) {
            $label = $match[1];
            if ($stack->pop() === 0) {
                $ip = $labels[$label];
            }
            continue;
        }

        switch ($op) {
            case '+':
                $stack->push($stack->pop() + $stack->pop());
                break;
            case '-':
                $n = $stack->pop();
                $stack->push($stack->pop() - $n);
                break;
            case '*':
                $stack->push($stack->pop() * $stack->pop());
                break;
            case '/':
                $n = $stack->pop();
                $stack->push($stack->pop() / $n);
                break;
            case '%':
                $n = $stack->pop();
                $stack->push($stack->pop() % $n);
                break;
            case '.':
                // 输出文本
                echo chr($stack->pop());
                break;
            case 'dup':
                // 复制
                $stack->push($stack->top());
                break;
            default:
                throw new InvalidArgumentException(sprintf('Invalid operation: %s', $op));
        }
    }

    return $stack->top();
}

function shunting_yard(array $tokens, array $operators): array
{
    $stack = new SplStack();
    $output = new SplQueue();

    foreach ($tokens as $token) {
        if (is_numeric($token)) {
            $output->enqueue($token);
        } elseif (isset($operators[$token])) {
            $o1 = $token;
            while (
                has_operator($stack, $operators)
                && ($o2 = $stack->top())
                && has_lower_precedence($o1, $o2, $operators)
            ) {
                $output->enqueue($stack->pop());
            }
            $stack->push($o1);
        } elseif ('(' === $token) {
            $stack->push($token);
        } elseif (')' === $token) {
            while (count($stack) > 0 && '(' !== $stack->top()) {
                $output->enqueue($stack->pop());
            }

            if (count($stack) === 0) {
                throw new InvalidArgumentException(sprintf('Mismatched parenthesis in input: %s', json_encode($tokens)));
            }

            // pop off '('
            $stack->pop();
        } else {
            throw new InvalidArgumentException(sprintf('Invalid token: %s', $token));
        }
    }

    while (has_operator($stack, $operators)) {
        $output->enqueue($stack->pop());
    }

    if (count($stack) > 0) {
        throw new InvalidArgumentException(sprintf('Mismatched parenthesis or misplaced number in input: %s', json_encode($tokens)));
    }

    return iterator_to_array($output);
}

function has_operator(SplStack $stack, array $operators): bool
{
    return count($stack) > 0 && ($top = $stack->top()) && isset($operators[$top]);
}

function has_lower_precedence($o1, $o2, array $operators): bool
{
    $op1 = $operators[$o1];
    $op2 = $operators[$o2];
    return ('left' === $op1['associativity']
            && $op1['precedence'] === $op2['precedence'])
        || $op1['precedence'] < $op2['precedence'];
}

$operators = [
    '+' => ['precedence' => 0, 'associativity' => 'left'],
    '-' => ['precedence' => 0, 'associativity' => 'left'],
    '*' => ['precedence' => 1, 'associativity' => 'left'],
    '/' => ['precedence' => 1, 'associativity' => 'left'],
    '%' => ['precedence' => 1, 'associativity' => 'left'],
];

if ($_SERVER['PHP_SELF'] === __FILE__) {
    // execute() test
    $rpn = '2 3 * 1 +';
    $ops = preg_split('/\s/', $rpn, -1, PREG_SPLIT_NO_EMPTY);
    var_dump(execute($ops));


    // shunting_yard() test
    $rpn = '2 3 * 1 +';
    $tokens = preg_split('/\s/', $rpn, -1, PREG_SPLIT_NO_EMPTY);
    $rpn = shunting_yard($tokens, $operators);
    print_r($rpn);


    // execute() && shunting_yard() test
    $rpn = '2 3 * 1 +';
    $tokens = preg_split('/\s/', $rpn, -1, PREG_SPLIT_NO_EMPTY);
    $rpn = shunting_yard($tokens, $operators);
    var_dump(execute($rpn));


    // io test
    $code = '104 . 101 . 108 . 108 . 111 . 44 . 32 . 119 . 111 . 114 . 108 . 100 . 10 . 10';
    $ops = preg_split('/\s/', $code, -1, PREG_SPLIT_NO_EMPTY);
    execute($ops);


    // dup test
    $code = '2 dup 5 + *';
    $ops = preg_split('/\s/', $code, -1, PREG_SPLIT_NO_EMPTY);
    $res = execute($ops);
    var_dump($res);


    // label && jmp && jz test
    $code = '
    0 10 100 108 114 111 119 32 44 111 108 108 101 104
    label(loop)
        dup
        jz(end)
        .
        jmp(loop)
    label(end)';
    $ops = preg_split('/\s/', $code, -1, PREG_SPLIT_NO_EMPTY);
    $res = execute($ops);


     // use regular expression to strip whitespace
    $code = '1 2
    +';
    $ops = preg_split('/\s/', $code, -1, PREG_SPLIT_NO_EMPTY);
    $res = execute($ops);
    var_dump($res);


    // strip comments
    $code = '1 
    # 这是一个注释 1
    2
    # 这是一个注释 2
    +';
    $ops = preg_split('/\s/', preg_replace('/^\s*#.*$/m', '', $code), -1, PREG_SPLIT_NO_EMPTY);
    $res = execute($ops);
    var_dump($res);
}
```
