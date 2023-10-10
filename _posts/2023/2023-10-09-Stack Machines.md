---
title: Stack Machines
layout: post
categories: [编译原理]
keywords: PHP,Stack Machines
---

`Stack Machines`，感觉不翻译看起来会顺眼一点，翻译成`栈机`感觉怪怪的。该文章总结自`Igor Wiedler`的`Stack Machines`系列文章，可惜他很久没贡献过代码以及没更新过博客了。先贴代码，到时候再写文章，可能需要一段时间来消化这个系列。

```php
<?php

const operators = [
    '+' => ['precedence' => 0, 'associativity' => 'left'],
    '-' => ['precedence' => 0, 'associativity' => 'left'],
    '*' => ['precedence' => 1, 'associativity' => 'left'],
    '/' => ['precedence' => 1, 'associativity' => 'left'],
    '%' => ['precedence' => 1, 'associativity' => 'left'],
];

function execute(array $ops)
{
    $labels = [];
    $vars = [];
    $calls = new SplStack();
    $stack = new SplStack();

    // 这里需要先获取所有 label，以防之后的 jmp/call 之类的指令找不到 label
    foreach ($ops as $ip => $op) {
        if (preg_match('/^label\((.+)\)$/', $op, $match)) {
            $label = $match[1];
            $labels[$label] = $ip;
        }
    }

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

        // 格式：jnz(main)，如果栈顶元素不为 0，则跳转到 main 标签
        if (preg_match('/^jnz\((.+)\)$/', $op, $match)) {
            $label = $match[1];
            if ($stack->pop() !== 0) {
                $ip = $labels[$label];
            }
            continue;
        }

        // 格式：call(printstr)，函数调用
        if (preg_match('/^call\((.+)\)$/', $op, $match)) {
            $label = $match[1];
            $calls->push($ip);
            $ip = $labels[$label];
            continue;
        }

        // 格式：value !var(varname)，声明变量并赋值为 $stack 顶的元素
        if (preg_match('/^!var\((.+)\)$/', $op, $match)) {
            $var = $match[1];
            $vars[$var] = $stack->pop();
            continue;
        }

        // 格式：var(varname)
        if (preg_match('/^var\((.+)\)$/', $op, $match)) {
            $var = $match[1];
            $stack->push($vars[$var]);
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
            case 'ret':
                $ip = $calls->pop();
                break;
            case '.num':
                // 输出数字本身
                echo $stack->pop();
                break;
            default:
                throw new InvalidArgumentException(sprintf('Invalid operation: %s', $op));
        }
    }

    if (count($stack) > 0) {
        return $stack->top();
    }
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

function execute_test(string $code = '', string $name = ''): void
{
    $ops = preg_split('/\s/', preg_replace('/^\s*#.*$/m', '', $code), -1, PREG_SPLIT_NO_EMPTY);
    $res = execute($ops);
    print_r($res);
    echo "\n************************************************************\t{$name}\n";
}

function shunting_yard_test(string $code = '', string $name = ''): void
{
    $ops = preg_split('/\s/', preg_replace('/^\s*#.*$/m', '', $code), -1, PREG_SPLIT_NO_EMPTY);
    $res = shunting_yard($ops, operators);
    print_r($res);
    echo "\n************************************************************\t{$name}\n";
}

if ($_SERVER['PHP_SELF'] === __FILE__) {
    // execute() test
    $rpn = '2 3 * 1 +';
    execute_test($rpn, 'execute()');


    // shunting_yard() test
    $rpn = '2 3 * 1 +';
    shunting_yard_test($rpn, 'shunting_yard()');


    // execute() && shunting_yard() test
    $rpn = '2 3 * 1 +';
    execute_test($rpn, 'execute()');
    shunting_yard_test($rpn, 'shunting_yard()');


    // io test
    $code = '104 . 101 . 108 . 108 . 111 . 44 . 32 . 119 . 111 . 114 . 108 . 100 . 10 . 10';
    execute_test($code, 'io');


    // dup test
    $code = '2 dup 5 + *';
    execute_test($code, 'dup');


    // label && jmp && jz test
    $code = '
    0 10 100 108 114 111 119 32 44 111 108 108 101 104
    label(loop)
        dup
        jz(end)
        .
        jmp(loop)
    label(end)';
    execute_test($code, 'label && jmp && jz');


    // use regular expression to strip whitespace
    $code = '1 2
    +';
    execute_test($code, 'strip whitespace');


    // strip comments
    $code = '1 
    # 这是一个注释 1
    2
    # 这是一个注释 2
    +';
    execute_test($code, 'comments');


    // calls
    $code = '
jmp(start)

label(printstr)
    label(loop)
        dup jz(end)
        .
        jmp(loop)
    label(end)
    call(test)
    ret
    
label(test)
    104 . 101 . 108 . 108 . 111 . 44 . 32 . 119 . 111 . 114 . 108 . 100 . 10 . 0
    ret
    
label(start)
    0 10 100 108 114 111 119 32 44 111 108 108 101 104
    call(printstr) 
    ';
    execute_test($code, 'calls');


    // variables：从栈上 pop 一个值并保存到变量 varname，!var(varname)，例如“42 !var(answer)”；将 varname 的值 push 到栈上，var(varname)，例如“var(answer)”
    $code = '
# i = 97
# ascii(97) is a
97 !var(i)

label(loop)
    # print i
    # i++
    # jump if i == 123
    # ascii(122) is z
    var(i) .
    var(i) 1 + !var(i)
    var(i) 123 -
    dup
    jnz(loop)
   
# print \n
10 .
    ';
    execute_test($code, 'variables');


    // variables 2
    $code = '
# define vars    
10 !var(i)
0 !var(p)
1 !var(n)
0 !var(tmp)

# output i prev
var(i) .num 32 .
var(p) .num 10 .

# output i n
var(i) .num 32 .
var(n) .num 10 .

label(next)
    var(i)
    jz(end)

    # tmp = n + p
    # p = n
    # n = tmp
    var(p) var(n) + !var(tmp)
    var(n) !var(p)
    var(tmp) !var(n)

    ## output i n
    var(i) .num 32 .
    var(n) .num 10 . 

    # i--
    var(i) 1 - !var(i)

    # print ...
    105 . 61 . var(i) .num 46 . 46 . 46 . 10 .

    var(i)
jmp(next)
label(end)
    ';
    execute_test($code, 'variables 2');
}
```
