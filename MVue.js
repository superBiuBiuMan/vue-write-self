const compileUtil = {
    //形参:节点 表达式 vue示例对象
    text(node,expr,vm){
        // expr 比如说可能会有双大括号,v-text
        let value;
        const reg = /\{{2}(.+?)\}{2}/gi;
        //expr 可能为 {{xxxx}}
        if(reg.test(expr)){
            value = expr.replace(reg,(_,group)=>{
                //为每一个{{xxx}}创建监听器
                new Watcher(group,vm,(newVal)=>{
                    //this.updaterFn.textUpdater(node,newVal);//将会导致整个被替换
                    this.updaterFn.textUpdater(node,this.getContentValue(expr,vm));
                })
                //获取到了匹配的分组,则使用当前找到到的值去替换{{xxx}}
                return this.getValue(group,vm.$data);
            })
        }else{
            //2.处理指令
            value = this.getValue(expr,vm.$data);
        }
        this.updaterFn.textUpdater(node,value);
    },
    html(node,expr,vm){
        const value = this.getValue(expr,vm.$data);
        new Watcher(expr,vm,(newValue)=>{
            this.updaterFn.htmlUpdater(node,newValue);
        })
        this.updaterFn.htmlUpdater(node,value);
    },
    model(node,expr,vm){
        const value = this.getValue(expr,vm.$data);
        new Watcher(expr,vm,(newValue)=>{
            this.updaterFn.modeUpdater(node,newValue);
        });
        node.addEventListener('input',e =>{
            this.setVal(expr,vm,e.target.value);
        })
        this.updaterFn.modeUpdater(node,value);
    },
    //事件处理 eventName,事件名
    on(node,fnName,vm,fnType){
        //fnType: click
        //fnName: handleClick
        //注意改变this的执行
        node.addEventListener(fnType,vm.$methods[fnName].bind(vm),false);
    },
    /*更新节点*/
    updaterFn:{
        //v-text更新
        textUpdater(node,value){
            node.textContent = value;
        },
        //v-html更新
        htmlUpdater(node,value){
            node.innerHTML = value;
        },
        modeUpdater(node,value){
            node.value = value;
        }
    },
    /*获取表达式的值*/
    getValue(expr,data){
        return expr.split(".").reduce((preData,itemKey)=>{
            return preData[itemKey]
        },data);
    },
    /*设置表达式的值*/
    setVal(expr,vm,inputValue){
        //当设置的值为person.fav这种多层对象的时候,会报错
        //expr.split(".").reduce((preData,currentValue)=>{
        //    console.log(preData)
        //    preData[currentValue] = inputValue;
        //},vm.$data)
        //所以下面是修复
        expr.split(".").reduce((preData,currentValueKey)=>{
            if(Object.prototype.toString.call(preData[currentValueKey]) === '[object Object]'){
                return preData[currentValueKey];
            }else{
                preData[currentValueKey] = inputValue;
            }
        },vm.$data)
    },
    getContentValue(expr,vm){
        const reg = /\{{2}(.+?)\}{2}/gi;
        return expr.replace(reg,(_,group)=>{
            //获取到了匹配的分组,则使用当前找到到的值去替换{{xxx}}
            return this.getValue(group,vm.$data);
        })
    }
}
/* 模板编译 */
class Compile {
    constructor(el,vm) {
        //1.获取DOM节点
        this.el = this.isElementNode(el) ? el : document.querySelector(el);
        this.vm = vm;
        //2.获取子节点文档碎片
        this.elFragment = this.getFragment(this.el);
        //3.编译模板
        this.compile(this.elFragment);
        //4.重新放置
        this.el.append(this.elFragment);
    }
    /*是否是元素节点*/
    isElementNode(el){
        return el?.nodeType === 1;
    }
    /*获取子节点所有文档碎片*/
    getFragment(node){
        const fragment = document.createDocumentFragment();
        let tempFragment;
        while(tempFragment = node.firstChild){
            fragment.append(tempFragment);
        }
        return fragment;
    }
    /*编译模板*/
    compile(nodeFragment){
        const childNodes = nodeFragment.childNodes;
        [...childNodes].forEach(node=>{
            if(this.isElementNode(node)){
                //编译元素节点
                this.compileElement(node);
            }else{
                //编译文本节点
                this.compileText(node);
            }
            if(node.childNodes && node.childNodes.length){
                this.compile(node);
            }
        })
    }
    /*编译元素节点*/
    compileElement(node){
        //1.获取元素身上的属性
        const attribute = node.attributes;
        if(attribute && attribute.length){
            //数组当中每一个都是属性节点(含有一些属性节点的方法,比如name,和value属性),
            [...attribute].forEach(item=>{
                //item为属性节点对象
                const {name,value} = item;//name: v-text,v-html,v-model,v-on:click value:msg,htmlStr,...
                if(this.isDirective(name)){
                    const [,directive] = name.split("-"); // directive之后变为 text,html model on:click;
                    const [directiveName,eventName] = directive.split(":");//directiveName: text,html,model //eventNae: click
                    compileUtil[directiveName](node,value,this.vm,eventName);
                    node.removeAttribute(name);
                }else if(this.isEventName(name)){
                    //为@事件
                    //console.log(name,value) name事件名(@click) value为事件回调函数名称handleClick
                    const [,eventName] = name.split("@");
                    compileUtil['on'](node,value,this.vm,eventName)
                    node.removeAttribute(name);
                }

            })
        }
    }
    /*编译文本节点*/
    compileText(node){
        const reg = /\{{2}(.+?)\}{2}/i;
        const context = node.textContent;
        if(reg.test(context)){
            compileUtil['text'](node,context,this.vm);
        }
    }
    /*是否是vue指令*/
    isDirective(value){
        return value.startsWith('v-');
    }
    /*是否是事件 也就是@xxx*/
    isEventName(value){
        return value.startsWith('@');
    }
}

class MVue {
    constructor(options) {
        this.$el = options.el;
        this.$data = options.data;
        this.$methods = options.methods;
        this.$options = options;
        if(this.$el){
            //1.数据观察
            new Observer(this.$data)
            //2.模板编译
            new Compile(this.$el,this);
            //3.数据代理
            this.proxyData(this.$data);
        }
    }
    proxyData(data){
        for(let key in data){
            Object.defineProperty(this,key,{
                get(){
                    return data[key];
                },
                set(newValue){
                    data[key] = newValue;
                }
            })
        }
    }
}
