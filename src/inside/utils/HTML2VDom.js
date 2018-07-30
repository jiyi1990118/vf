// HTML解析包
import HTMLParser from './HTMLParser';

// 字符串处理包
import string from '../lib/string';

// 语法解析
import syntaxTree from './abstractSyntaxTree';

// 虚拟Dom包
import vdom from './vdom';

// 日志包
import log from './log';

/**
 * html字符串转虚拟dom
 * @param htmlStr
 * @returns {Array}
 */
function str2vdom(htmlStr) {
	const eleStruct = [];
	
	let nowStruct;
	let structLevel = [];
	
	HTMLParser(string.HTMLDecode(htmlStr), {
		//标签节点起始
		start: function (tagName, attrs, unary) {
			nowStruct = vdom.vnode(
				tagName,
				{
					attrsMap: attrs.reduce(function (attrs, current) {
						
						// 修饰符
						const modifier = current.name.split('.');
						
						// 属性名称
						const attrName = modifier.shift();
						
						// 属性名称
						const attrInfo = {
							fullName: current.name,
							name: attrName,
							value: current.value,
							type: modifier.shift(),
							modifier: modifier
						}
						
						// 检查是是双向属性
						if (attrName.substr(0, 2) === '@:') {
							attrInfo.name = attrName.slice(2);
							
							// 标识 内外属性
							attrInfo.isInner = true;
							attrInfo.isOuter = true;
						} else {
							switch (attrName.charAt(0)) {
								case '@':
									// 标识由内向外传递
									attrInfo.isInner = true;
									attrInfo.name = attrName.slice(1);
									break;
								case ':':
									// 标识由外向内传递
									attrInfo.isOuter = true;
									attrInfo.name = attrName.slice(1);
									break;
							}
							
						}
						
						// 检查同元素上是否由同样的属性
						if (attrs[attrInfo.name]) {
							log.warn('同元素上 ' + attrInfo.name + ' 属性已经被定义过 [ ' + attrs[attrInfo.name].fullName + ' = "' + attrs[attrInfo.name].value + '" ]')
						}
						
						attrs[attrInfo.name] = attrInfo;
						
						return attrs;
					}, {})
				},
				[]
			)
			
			structLevel.push(nowStruct)
			if (unary) {
				this.end();
			}
		},
		//标签节点结束
		end: function () {
			//前一个元素结构
			let parentStruct = structLevel.pop();
			
			//检查当前是否顶级层级
			if (structLevel.length) {
				//检查当前元素是否子元素
				if (parentStruct === nowStruct) {
					parentStruct = structLevel[structLevel.length - 1];
				}
				parentStruct.children.push(nowStruct);
				nowStruct = parentStruct;
			} else {
				if (parentStruct !== nowStruct) {
					parentStruct.children.push(nowStruct)
				}
				eleStruct.push(parentStruct)
			}
		},
		//文本节点
		chars: function (text) {
			//空字符直接忽略
			if (/^\s+$/.test(text)) return
			
			//获取界定符位置
			//界定符
			const DelimiterLeft = "{{",
				DelimiterRight = "}}";
			
			// 文本表达式容器
			let exps = [],
				// 常规文本容器
				strs = [],
				// 标识是否存在表达式
				existExp=false;
			
			/**
			 * 获取表达式
			 * @param text
			 * @returns {*}
			 */
			(function findExp(text) {
				let sid,
					eid,
					str;
				
				if (text.length) {
					
					// 检查是否存在表达式界定符号
					if ((sid = text.indexOf(DelimiterLeft)) === -1 || (eid = text.indexOf(DelimiterRight, sid)) === -1) {
						exps.push(text);
						strs.push(text);
					} else {
						if (sid) {
							str = text.slice(0, sid);
							exps.push(str);
							strs.push(str);
						}
						// 标识存在表达式
						existExp=true;
						//截取界定符中的表达式字符
						const expStr = text.slice(sid + DelimiterLeft.length).slice(0, eid - sid - DelimiterLeft.length);
						
						const syntaxStruct=syntaxTree(expStr);
						//解析表达式
						exps.push(syntaxStruct);
						//剩下的字符
						findExp(text.slice(eid + DelimiterRight.length));
					}
				}
				return text;
			})(text)
			
			const nowStruct = vdom.vnode(
				undefined,
				{
					textExp: exps,
					existExp:existExp,
				},
				undefined,
				strs.join('')
			)
			
			//检查当前是否顶级层级
			if (structLevel.length) {
				structLevel[structLevel.length - 1].children.push(nowStruct)
			} else {
				eleStruct.push(nowStruct)
			}
		}
	})
	structLevel = undefined;
	return eleStruct.length === 1 ? eleStruct[0] : eleStruct;
}

/**
 * html 转换成虚拟dom数据结构
 */
export default function (html) {
	//检查是否dom节点
	return html.nodeName ? vdom.node2vnode(html) : str2vdom(html);
};