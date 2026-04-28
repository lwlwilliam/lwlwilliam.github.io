---
title: MySQL explain
layout: post
categories: [数据库]
keywords: 数据库, SQL, explain, MySQL
---

MySQL explain 示例：

| id | select_type | table | partitions | type | possible_keys | key | key_len | ref | rows | filtered | Extra |
| :--: | :--: | :--: | :--: | :--: | :--: | :--: | :--: | :--: | :--: | :--: | :--: |
|  1 | PRIMARY     | test  | NULL       | const | PRIMARY       | PRIMARY | 4       | const |    1 |   100.00 | NULL        |
|  2 | SUBQUERY    | test2 | NULL       | const | PRIMARY       | PRIMARY | 4       | const |    1 |   100.00 | Using index |
|  3 | SUBQUERY    | test3 | NULL       | ALL   | NULL          | NULL    | NULL    | NULL  |    3 |    33.33 | Using where |


| id | select_type | table | partitions | type | possible_keys | key | key_len | ref | rows | filtered | Extra |
| :--: | :--: | :--: | :--: | :--: | :--: | :--: | :--: | :--: | :--: | :--: | :--: |
|  1 | SIMPLE      | test2 | NULL       | ALL    | PRIMARY       | NULL    | NULL    | NULL         |    6 |    16.67 | Using where |
|  1 | SIMPLE      | test  | NULL       | eq_ref | PRIMARY       | PRIMARY | 4       | db1.test2.id |    1 |   100.00 | NULL        |


字段说明：

### id

select 查询的序列号，表示查询中执行 select 子句或操作表的顺序。

1.  id 相同，执行顺序由上到下；
2.  id 不同，如果是子查询，id 的序号会递增，id 越大优先级越高，越先被执行；
3.  id 相同不同，同时存在，同1、2；


### select_type

1.  SIMPLE：简单的 select 查询，查询中不包含子查询或者 union；
2.  PRIMARY：查询中若包含任何复杂的子部分，最外层查询则被标记为 PRIMARY；
3.  SUBQUERY：在 select 或 where 列表中包含了子查询；
4.  DERIVED：在 from 列表中包含的子查询被标记为 DERIVED（衍生），MySQL 会递归执行这些子查询，把结果放在临时表里；
5.  UNION：若第二个 select 出现在 union 之后，则被标记为 UNION；若 union 包含在 from 子句的子查询中，外层 select 将被标记为 DERIVED；
6.  UNION RESULT：从 union 表获取结果的 select；

### table

无需多说了。。。

### type

访问类型，主要有八种值，最好到最差依次为：system > const > eq_ref > ref > range > index > ALL。

1.  ALL：Full Table Scan，将遍历全表以找到匹配的行；
2.  index：Full Index Scan，index 与 ALL 区别，index 类型只遍历索引树，这通常比 ALL 快，因为索引文件通常比数据文件小（也就是说虽然 ALL 和 index 都是读全表，但 index 是从索引中读取的，而 all 是从硬盘中读取的）；
3.  range：只检索给定范围的行，使用一个索引来选择行，key 列显示使用了哪个索引；一般就是在 where 语句中出现了 between、<、>、in 等的查询，这种范围扫描比全表扫描要好，因为它只需要开始于索引的某一点，而结束于另一点，不用扫描全部索引；例如：

    ```mysql
    explain select * from test where id > 2;
    ```

4.  ref：非唯一性索引扫描，返回匹配某个单独值的所有行，本质上也是一种索引访问，它返回所有匹配某个单独值的行，然而，它可能会找到多个符合条件的行，所以它应该属于查找和扫描的混合体；例如，name 是索引，查询如下：

    ```mysql
    explain select * from test where name = 'a';
    ```

5.  eq_ref：唯一性索引扫描，对于每个索引键，表中只有一条记录与之匹配。常见于主键或者唯一索引扫描；
6.  const：表示通过索引一次就找到了，const 用于比较 primary key 或者 unique 索引。因为只匹配一行数据，所以很快。例如，id 是表主键，查询如下：

    ```mysql
    explain select * from test where id = 1;
    ```
    
7.  system：表只有一行记录（等于系统表），这是 const 类型的特例，平时不会出现，这个也可以忽略不计；
8.  NULL；


### possible_keys 和 keys

possible_keys 显示可能应用在这张表中的索引，一个或多个；查询涉及到的字段上若存在索引，则该索引将被列出，但不一定被查询实际使用。
key 是实际使用的索引。如果为 NULL，则没有使用索引；查询中若使用了覆盖索引，则该索引仅出现在 key 列表中。

### key_len

表示索引中使用的字节数，可通过该列计算查询中使用的索引长度。在不损失精确性的情况下，长度越短越好。key_len 显示的值是索引字段的最大可能长度，并非实际使用长度，即 key_len 是根据表定义计算而得，不是通过表内检索出的。

### ref

显示索引的哪一列被使用了，如果可能的话，是一个常数，哪些列或常量被用于查找索引列上的值。

### rows

根据表统计信息及索引选用情况，大致估算出找到所需的记录所需要读取的行数。

### Extra

TODO
