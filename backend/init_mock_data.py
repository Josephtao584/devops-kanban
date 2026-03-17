#!/usr/bin/env python3
"""
初始化 Mock 数据脚本
用于创建示例项目、需求、任务和角色数据
"""

import json
from pathlib import Path
from datetime import datetime

# 数据目录（项目根目录）
DATA_DIR = Path(__file__).parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)


def create_mock_data():
    now = datetime.utcnow().isoformat()

    # ============ 项目数据 ============
    projects = [
        {
            "id": 1,
            "name": "DevOps 看板系统",
            "description": "基于 AI 代理的 DevOps 看板管理系统，支持任务自动化执行",
            "repository_url": "https://github.com/example/devops-kanban",
            "local_path": "/Users/taowenpeng/IdeaProjects/devops-kanban",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": 2,
            "name": "电商平台重构",
            "description": "新一代电商平台重构项目，支持高并发场景",
            "repository_url": "https://github.com/example/ecommerce-platform",
            "local_path": "/Users/taowenpeng/IdeaProjects/ecommerce-platform",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": 3,
            "name": "数据分析平台",
            "description": "企业级数据分析与可视化平台",
            "repository_url": "https://github.com/example/data-analytics",
            "local_path": "/Users/taowenpeng/IdeaProjects/data-analytics",
            "created_at": now,
            "updated_at": now
        }
    ]

    # ============ 需求数据 ============
    requirements = [
        {
            "id": 1,
            "project_id": 1,
            "title": "项目管理模块",
            "description": "实现项目的基本 CRUD 操作，支持项目的创建、编辑、删除和查询",
            "status": "APPROVED",
            "priority": "HIGH",
            "acceptance_criteria": "1. 可以创建新项目\n2. 可以编辑项目信息\n3. 可以删除项目\n4. 可以查看项目列表和详情",
            "created_by": "张三",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": 2,
            "project_id": 1,
            "title": "任务看板功能",
            "description": "实现可视化任务看板，支持拖拽操作和状态流转",
            "status": "APPROVED",
            "priority": "HIGH",
            "acceptance_criteria": "1. 显示任务看板\n2. 支持拖拽改变状态\n3. 支持任务筛选",
            "created_by": "张三",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": 3,
            "project_id": 1,
            "title": "AI 代理集成",
            "description": "集成 AI 代理自动执行任务，支持多种 Agent",
            "status": "DRAFT",
            "priority": "CRITICAL",
            "acceptance_criteria": "1. 支持 Claude Code 代理\n2. 支持任务自动执行\n3. 显示执行日志",
            "created_by": "李四",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": 4,
            "project_id": 1,
            "title": "WebSocket 实时通信",
            "description": "实现前端与后端的实时通信，支持终端会话功能",
            "status": "DRAFT",
            "priority": "MEDIUM",
            "acceptance_criteria": "1. 建立 WebSocket 连接\n2. 支持实时日志输出\n3. 支持交互式命令",
            "created_by": "王五",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": 5,
            "project_id": 2,
            "title": "用户认证系统",
            "description": "实现用户登录、注册、权限管理功能",
            "status": "APPROVED",
            "priority": "CRITICAL",
            "acceptance_criteria": "1. 支持邮箱登录\n2. 支持 JWT 认证\n3. 支持角色权限",
            "created_by": "赵六",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": 6,
            "project_id": 2,
            "title": "商品管理模块",
            "description": "实现商品的 CRUD 操作和库存管理",
            "status": "APPROVED",
            "priority": "HIGH",
            "acceptance_criteria": "1. 商品列表展示\n2. 商品详情编辑\n3. 库存预警",
            "created_by": "赵六",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": 7,
            "project_id": 3,
            "title": "数据源接入",
            "description": "支持多种数据源接入，包括 MySQL、PostgreSQL、MongoDB",
            "status": "APPROVED",
            "priority": "HIGH",
            "acceptance_criteria": "1. 支持 MySQL\n2. 支持 PostgreSQL\n3. 支持 MongoDB",
            "created_by": "钱七",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": 8,
            "project_id": 3,
            "title": "数据可视化",
            "description": "实现丰富的图表类型，支持自定义仪表盘",
            "status": "DRAFT",
            "priority": "MEDIUM",
            "acceptance_criteria": "1. 支持折线图、柱状图、饼图\n2. 支持自定义仪表盘\n3. 支持图表导出",
            "created_by": "钱七",
            "created_at": now,
            "updated_at": now
        }
    ]

    # ============ 任务数据 ============
    tasks = [
        # 项目 1 的任务
        {
            "id": 1,
            "project_id": 1,
            "requirement_id": 1,
            "title": "创建项目实体类",
            "description": "定义 Project 实体类，包含基本属性和关系",
            "status": "DONE",
            "priority": "HIGH",
            "assignee": "开发者 A",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": 2,
            "project_id": 1,
            "requirement_id": 1,
            "title": "实现项目 Repository",
            "description": "实现项目数据访问层，支持文件存储",
            "status": "DONE",
            "priority": "HIGH",
            "assignee": "开发者 A",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": 3,
            "project_id": 1,
            "requirement_id": 1,
            "title": "实现项目 API 接口",
            "description": "创建 RESTful API 接口，支持 CRUD 操作",
            "status": "IN_PROGRESS",
            "priority": "HIGH",
            "assignee": "开发者 B",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": 4,
            "project_id": 1,
            "requirement_id": 2,
            "title": "设计看板 UI 布局",
            "description": "设计看板页面的 UI 布局和交互效果",
            "status": "DONE",
            "priority": "MEDIUM",
            "assignee": "设计师 C",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": 5,
            "project_id": 1,
            "requirement_id": 2,
            "title": "实现拖拽功能",
            "description": "使用 VueDraggable 实现任务卡片的拖拽功能",
            "status": "IN_PROGRESS",
            "priority": "HIGH",
            "assignee": "开发者 A",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": 6,
            "project_id": 1,
            "requirement_id": 2,
            "title": "添加任务筛选功能",
            "description": "支持按优先级、负责人、状态筛选任务",
            "status": "TODO",
            "priority": "MEDIUM",
            "assignee": "开发者 B",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": 7,
            "project_id": 1,
            "requirement_id": 3,
            "title": "调研 AI 代理方案",
            "description": "调研可行的 AI 代理集成方案",
            "status": "DONE",
            "priority": "HIGH",
            "assignee": "架构师 D",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": 8,
            "project_id": 1,
            "requirement_id": 3,
            "title": "实现 Claude Code 适配器",
            "description": "实现 Claude Code Agent 的适配器",
            "status": "TODO",
            "priority": "CRITICAL",
            "assignee": "开发者 A",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": 9,
            "project_id": 1,
            "requirement_id": 4,
            "title": "配置 WebSocket 服务",
            "description": "配置 Spring Boot WebSocket 服务",
            "status": "BLOCKED",
            "priority": "MEDIUM",
            "assignee": "开发者 B",
            "created_at": now,
            "updated_at": now
        },
        # 项目 2 的任务
        {
            "id": 10,
            "project_id": 2,
            "requirement_id": 5,
            "title": "设计用户数据库表",
            "description": "设计用户、角色、权限相关的数据库表结构",
            "status": "DONE",
            "priority": "CRITICAL",
            "assignee": "架构师 E",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": 11,
            "project_id": 2,
            "requirement_id": 5,
            "title": "实现 JWT 认证",
            "description": "实现 JWT Token 的生成和验证逻辑",
            "status": "IN_PROGRESS",
            "priority": "CRITICAL",
            "assignee": "开发者 F",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": 12,
            "project_id": 2,
            "requirement_id": 6,
            "title": "创建商品 API",
            "description": "实现商品管理的 RESTful API",
            "status": "TODO",
            "priority": "HIGH",
            "assignee": "开发者 G",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": 13,
            "project_id": 2,
            "requirement_id": 6,
            "title": "实现库存预警逻辑",
            "description": "当库存低于阈值时触发预警",
            "status": "TODO",
            "priority": "MEDIUM",
            "assignee": "开发者 G",
            "created_at": now,
            "updated_at": now
        },
        # 项目 3 的任务
        {
            "id": 14,
            "project_id": 3,
            "requirement_id": 7,
            "title": "实现 MySQL 连接器",
            "description": "实现 MySQL 数据库连接和数据读取",
            "status": "DONE",
            "priority": "HIGH",
            "assignee": "开发者 H",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": 15,
            "project_id": 3,
            "requirement_id": 7,
            "title": "实现 PostgreSQL 连接器",
            "description": "实现 PostgreSQL 数据库连接和数据读取",
            "status": "IN_PROGRESS",
            "priority": "HIGH",
            "assignee": "开发者 H",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": 16,
            "project_id": 3,
            "requirement_id": 8,
            "title": "集成 ECharts 图表库",
            "description": "集成 ECharts 并实现基础图表类型",
            "status": "TODO",
            "priority": "MEDIUM",
            "assignee": "前端开发 I",
            "created_at": now,
            "updated_at": now
        },
        {
            "id": 17,
            "project_id": 3,
            "requirement_id": 8,
            "title": "实现仪表盘配置",
            "description": "支持用户自定义仪表盘布局和图表",
            "status": "TODO",
            "priority": "LOW",
            "assignee": "前端开发 I",
            "created_at": now,
            "updated_at": now
        }
    ]

    # ============ 角色数据 ============
    roles = [
        {
            "id": 1,
            "project_id": 1,
            "name": "项目管理员",
            "description": "项目管理员，拥有项目的所有权限",
            "permissions": ["project:read", "project:write", "project:delete", "task:read", "task:write", "task:delete", "requirement:read", "requirement:write", "requirement:delete", "member:manage"],
            "created_at": now,
            "updated_at": now
        },
        {
            "id": 2,
            "project_id": 1,
            "name": "开发者",
            "description": "项目开发者，可以查看和编辑任务",
            "permissions": ["project:read", "task:read", "task:write", "requirement:read"],
            "created_at": now,
            "updated_at": now
        },
        {
            "id": 3,
            "project_id": 1,
            "name": "观察者",
            "description": "项目观察者，只读权限",
            "permissions": ["project:read", "task:read", "requirement:read"],
            "created_at": now,
            "updated_at": now
        },
        {
            "id": 4,
            "project_id": 2,
            "name": "产品负责人",
            "description": "产品负责人，管理需求和优先级",
            "permissions": ["project:read", "requirement:read", "requirement:write", "requirement:delete", "task:read"],
            "created_at": now,
            "updated_at": now
        },
        {
            "id": 5,
            "project_id": 2,
            "name": "开发工程师",
            "description": "负责开发和实现功能",
            "permissions": ["project:read", "requirement:read", "task:read", "task:write"],
            "created_at": now,
            "updated_at": now
        },
        {
            "id": 6,
            "project_id": 3,
            "name": "数据分析师",
            "description": "负责数据分析和报表",
            "permissions": ["project:read", "datasource:read", "datasource:write", "dashboard:read", "dashboard:write"],
            "created_at": now,
            "updated_at": now
        }
    ]

    # ============ 团队成员数据 ============
    members = [
        {
            "id": 1,
            "project_id": 1,
            "user_id": 1001,
            "name": "张三",
            "email": "zhangsan@example.com",
            "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=zhangsan",
            "role_id": 1,
            "role_name": "项目管理员",
            "department": "研发部",
            "joined_at": "2026-01-15T09:00:00",
            "status": "ACTIVE"
        },
        {
            "id": 2,
            "project_id": 1,
            "user_id": 1002,
            "name": "李四",
            "email": "lisi@example.com",
            "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=lisi",
            "role_id": 2,
            "role_name": "开发者",
            "department": "研发部",
            "joined_at": "2026-01-16T09:00:00",
            "status": "ACTIVE"
        },
        {
            "id": 3,
            "project_id": 1,
            "user_id": 1003,
            "name": "王五",
            "email": "wangwu@example.com",
            "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=wangwu",
            "role_id": 2,
            "role_name": "开发者",
            "department": "研发部",
            "joined_at": "2026-01-17T09:00:00",
            "status": "ACTIVE"
        },
        {
            "id": 4,
            "project_id": 1,
            "user_id": 1004,
            "name": "赵六",
            "email": "zhaoliu@example.com",
            "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=zhaoliu",
            "role_id": 3,
            "role_name": "观察者",
            "department": "产品部",
            "joined_at": "2026-02-01T09:00:00",
            "status": "ACTIVE"
        },
        {
            "id": 5,
            "project_id": 2,
            "user_id": 1005,
            "name": "钱七",
            "email": "qianqi@example.com",
            "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=qianqi",
            "role_id": 4,
            "role_name": "产品负责人",
            "department": "产品部",
            "joined_at": "2026-01-20T09:00:00",
            "status": "ACTIVE"
        },
        {
            "id": 6,
            "project_id": 2,
            "user_id": 1006,
            "name": "孙八",
            "email": "sunba@example.com",
            "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=sunba",
            "role_id": 5,
            "role_name": "开发工程师",
            "department": "研发部",
            "joined_at": "2026-01-21T09:00:00",
            "status": "ACTIVE"
        },
        {
            "id": 7,
            "project_id": 2,
            "user_id": 1007,
            "name": "周九",
            "email": "zhoujiu@example.com",
            "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=zhoujiu",
            "role_id": 5,
            "role_name": "开发工程师",
            "department": "研发部",
            "joined_at": "2026-01-22T09:00:00",
            "status": "ACTIVE"
        },
        {
            "id": 8,
            "project_id": 2,
            "user_id": 1008,
            "name": "吴十",
            "email": "wushi@example.com",
            "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=wushi",
            "role_id": 5,
            "role_name": "开发工程师",
            "department": "测试部",
            "joined_at": "2026-02-05T09:00:00",
            "status": "ACTIVE"
        },
        {
            "id": 9,
            "project_id": 3,
            "user_id": 1009,
            "name": "郑十一",
            "email": "zhengshiyi@example.com",
            "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=zhengshiyi",
            "role_id": 1,
            "role_name": "项目管理员",
            "department": "数据部",
            "joined_at": "2026-01-25T09:00:00",
            "status": "ACTIVE"
        },
        {
            "id": 10,
            "project_id": 3,
            "user_id": 1010,
            "name": "刘十二",
            "email": "liushier@example.com",
            "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=liushier",
            "role_id": 6,
            "role_name": "数据分析师",
            "department": "数据部",
            "joined_at": "2026-01-26T09:00:00",
            "status": "ACTIVE"
        },
        {
            "id": 11,
            "project_id": 3,
            "user_id": 1011,
            "name": "陈十三",
            "email": "chenshisan@example.com",
            "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=chenshisan",
            "role_id": 6,
            "role_name": "数据分析师",
            "department": "数据部",
            "joined_at": "2026-02-10T09:00:00",
            "status": "ACTIVE"
        },
        {
            "id": 12,
            "project_id": 1,
            "user_id": 1012,
            "name": "褚十四",
            "email": "chushisi@example.com",
            "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=chushisi",
            "role_id": 2,
            "role_name": "开发者",
            "department": "研发部",
            "joined_at": "2026-03-01T09:00:00",
            "status": "INACTIVE"
        }
    ]

    # 写入文件
    def write_json(filename, data):
        file_path = DATA_DIR / filename
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"✓ 创建 {filename}")

    write_json("projects.json", projects)
    write_json("requirements.json", requirements)
    write_json("tasks.json", tasks)
    write_json("roles.json", roles)
    write_json("members.json", members)

    print("\n✅ Mock 数据创建完成!")
    print(f"📁 数据目录：{DATA_DIR}")
    print("\n数据概览:")
    print(f"  - 项目：{len(projects)} 个")
    print(f"  - 需求：{len(requirements)} 个")
    print(f"  - 任务：{len(tasks)} 个")
    print(f"  - 角色：{len(roles)} 个")
    print(f"  - 团队成员：{len(members)} 个")


if __name__ == "__main__":
    create_mock_data()
