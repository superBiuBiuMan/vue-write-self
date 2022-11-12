/*监听者*/
class Watcher {
    /* 注意,expr只能为表达式,不能有{{xxx}},这种,如果有{{xxx}}这种,请传入中间的xxx */
    constructor(expr,vm,cb) {
        //console.log("watcher构造函数开始");
        this.expr = expr;
        this.vm = vm;
        this.cb = cb;
        this.oldValue = this.getOldValue();//保存初始化值-也就是旧值,为了和新值对比
    }
    /*获取初始值*/
    getOldValue(){
        Dep.target = this;//向Dep身上添加属性this,即为当前创建的watcher实例对象
        const oldValue = compileUtil.getValue(this.expr,this.vm.$data);//获取表达式的值,会掉用set方法,从而触发Observer当中的dep添加订阅
        Dep.target = null;
        return oldValue;
    }
    /*更新函数 - 执行创建watcher时候传递过来的回调*/
    update(){
        const newValue = compileUtil.getValue(this.expr,this.vm.$data);//从vm身上的data重新获取新值,因为已经通过defineProperty设置了,所以会更新到data当中
        if(this.oldValue !== newValue){
            this.cb(newValue);//重新更新新值
        }
    }
}
/*订阅器*/
class Dep{
    constructor(){
        this.subs = [];
    }
    /*添加订阅 订阅者就是每一个watcher*/
    addSub(watcher){
        this.subs.push(watcher);
    }
    /*通知订阅者*/
    notify(){
        //console.log("观察者",this.subs)
        //通知里面的所有watch,去执行new Watcher传递过来的回调,达到更新的目的(这里添加了新旧值对比,所以不会更新未变动的值)
        this.subs.forEach(item=>item.update());
    }
}
/*数据观察*/
class Observer{
    constructor(data) {
        this.observer(data);
    }
    observer(data){
        if(data && Object.prototype.toString.call(data) === '[object Object]'){
            Object.keys(data).forEach(key=>{
                this.defineReactive(data,key,data[key]);
            })
        }
    }
    /*设置响应式*/
    defineReactive(data,key,value){
        if(Object.prototype.toString.call(value) === '[object Object]'){
            //继续送去观察如果是对象
            this.observer(value);
        }
        //为每一个属性创建dep(这样子后面一次性就可以更新全部了),相当于订阅器
        const dep = new Dep();
        Object.defineProperty(data,key,{
            enumerable:true,
            configurable:false,
            get(){
                /**
                 *    获取旧值表达式为以下
                 *    getOldValue(){
                 * 		Dep.target = this;
                 * 		const oldvalue = compileUtil.getValue(this.expr,this.vm.$data);
                 * 		Dep.target = null;
                 * 		return oldValue;
                 * 	}
                 *    一开始我看到这个,很奇怪,角色这样子会可以让Observer成功添加到watcher吗?
                 *    是的,的确可以,在Observer当中,我们通过defineProperty为data当中的每一个属性添加了set和get方法,也就是说
                 * 我们每次读取值也会触发set,设置值则会触发get,所以当我们初始化页面编译模板的时候,就会触发set,从而向对应的dep添加对应的watcher
                 *
                 *    所以这就解释了调用compileUtil.getValue()之后就会添加watcher的问题
                 *
                 *    那么为什么需要取消呢?
                 *    在我们触发更新的时候,通过set设置了新值,后面肯定需要显示在页面,所以我们肯定需要调用get方法,此时如果我们不设置Dep.target = null,
                 *  那么就会导致对应的watcher被重复添加了
                 */
                //向dep添加watcher(观察者)
                Dep.target && dep.addSub(Dep.target);  //当我们获取表达式值的时候,就会被调用get
                //返回observer传递过来的value,这样子set就可以更改value,并且不会引发重复调用问题
                return value;
            },
            //注意,这里是箭头函数
            set:(newVal)=>{
                if(newVal !== value){
                    //注意这里的value究竟是什么value,实际上的observer传递过来的value
                    //监视新添加的值
                    this.observer(newVal);
                    value = newVal;
                }
                //通知对应属性的所有的watch去更新
                dep.notify();
            }
        })
    }
}
