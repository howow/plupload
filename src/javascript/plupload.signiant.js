define(['lib/plupload/plupload'], function(){

(function(plupload){
    var deployJava,
        tmpl,
        instances = {},
        bind = (function(){
            var fn = function(){};
            if(document.addEventListener){
                fn = function(el, type, callback){
                    el.addEventListener(type, callback, false);
                };
            }else if (document.attachEvent){
                fn = function(el, type, callback){
                    el.attachEvent('on' + type, callback);
                };
            }

            return function(el, type, callback){
                return fn(el, type, callback);
            };
        })(),
        curriedHandler = function(id, type){
            return function(data, data2, data3){
                instances[id].trigger('Signiant.' + type, data, data2, data3);
            };
        };
    
    plupload.runtimes.Signiant = plupload.addRuntime('signiant', {
       getFeatures: function(){
			return {
				jpgresize: false,
				pngresize: false,
				chunks: false,
				progress: true,
				multipart: false,
				pause: true
			};
       },
       init: function(uploader, callback){
            // If java isnt available fallback
           	if (!navigator.javaEnabled() || (!deployJava.versionCheck('1.6.0+') && !deployJava.versionCheck('1.4') && !deployJava.versionCheck('1.5.0*'))) {
           		callback({success: false});
           		return;
           	}
           	var container, browseButton, dropElement, selectedFiles = [];
           	
           	instances[uploader.id] = uploader;
           	
           	container = document.createElement('div');
           	container.className = 'signiant-container';
           	container.id = 'signiant_container_'+uploader.id;
           	
           	container.innerHTML = tmpl(uploader);
           	
           	var getApplet = (function(){
           	    var applet;
           	    
           	    return function(){
           	        if(!applet){
           	            applet = document.getElementById('SigniantApplet_' + uploader.id), applet;
           	        }
           	        return applet;
           	    };
           	})();
            
            uploader.bind('Init', function(up) {
               	// Trigger the file selector on browse
               	browseButton = plupload.getElement(up.settings.browse_button);
               	dropElement = plupload.getElement(up.settings.drop_element)
               	
               	up.trigger('BrowseButtonRendered', up);
               	var dimensions;
               	if(dropElement){
               	    dropElement.appendChild(container);
                    dimensions = {
                      width: dropElement.clientWidth,
                      height: dropElement.clientHeight,
                      top: dropElement.offsetTop,
                      left: dropElement.offsetLeft
                    };
               	}else{
               	    document.body.appendChild(container);
                    dimensions = {
                      width: 1,
                      height: 1,
                      top: 0,
                      left: 0
                    };
               	}
               	
               	browseButton.style.zIndex = 2;
               	
               	getApplet().style.opacity = 0;
               	getApplet().style.zIndex = 1;
               	getApplet().style.width = dimensions.width + 'px';
               	getApplet().style.height = dimensions.height + 'px';
            });
           	
           	uploader.bind('Signiant.FilesSelected', (function(){
           	    var FILE_RE = /[^\\/]*$/;
           	    
           	    return function(up, data, sizes, mime_types){
           	        var newFiles = (data + '').split('||'),
           	            newSizes = (sizes + '').split('||'),
                        newMimeTypes = (mime_types + '').split('||'),
           	            file, files = [], i, id;
           	            
					// Add the selected files to the file queue
					for (i = 0; i < newFiles.length; i++){
					    file = newFiles[i];
						newFile = new plupload.File(plupload.guid(), file.match(FILE_RE)[0], parseInt(newSizes[i], 10));
                        newFile.fullpath = file;
                        newFile.mimetype = newMimeTypes[i];
						files.push(newFile);
					}
                    selectedFiles = selectedFiles.concat(files);
                    
					// Trigger FilesAdded event if we added any
					if(files.length){
						up.trigger('FilesAdded', files);
					}
                };
           	})());

            uploader.bind('Signiant.Progress', function(up, percentComplete, transferRate){
              up.trigger('UploadProgress', percentComplete, transferRate);
            });

            uploader.bind('Signiant.Complete', function(up, status){
              up.trigger('UploadComplete', status);
            });
           	
           	uploader.bind('UploadFile', function(up, file) {
                var filePaths = [];
                for(var i = 0; i < selectedFiles.length; i++){
                  filePaths.push(selectedFiles[i].fullpath);
                }
           	    getApplet().uploadFiles(filePaths.join('||'));
           	});
           	
           	uploader.bind('CancelUpload', function(){
           	   getApplet().cancelTransfer();
           	});
           	
           	uploader.bind('PauseUpload', function(up) {
                getApplet().pauseTransfer();
           	});
           	
           	uploader.bind('ResumeUpload', function(up) {
                getApplet().resumeTransfer();
           	});

            uploader.bind('BrowseButtonRendered', function(up) {
                browseButton = plupload.getElement(up.settings.browse_button);
                bind(browseButton, 'click', function(){
                  getApplet().chooseFilesForUI('false', 'false');
                });
            });
           	
           	callback({success: true});
       }
    });
    tmpl = (function(){
        var i, methods = 'Cancel Complete Logfile Connection Pause Resume Status ProtocolChange Progress FilesSelected FolderSelected'.split(' '), l = methods.length;
    
        
        return function(up){
            var html;
            if(window.ActiveXObject){
                html = '<object classid="clsid:8AD9C840-044E-11D1-B3E9-00805F499D93" id="SigniantApplet_' + up.id + '" name="SigniantApplet_' + up.id + '" width="100%" height="100%" codebase="https://java.sun.com/update/1.5.0/jinstall-1_5_0_03-windowsi586.cab#Version=1,5,0,0">';
            }else{
                html = '<object type="application/x-java-applet;version=1.5" id="SigniantApplet_' + up.id + '" name="SigniantApplet_' + up.id + '" width="100%" height="100%">';
            }
            
            html += 
            	    '<param name="code" value="CTEApplet.class" />' + 
           	        '<param name="java_code" value="CTEApplet.class"/>' + 
            	    '<param name="java_archive" value="' + up.settings.signiant_path + 'signiant-applet.jar,' + up.settings.signiant_path + 'webclient.jar"/>';

            for(i=0; i < l; i++){
                html += '<param name="on' + methods[i] + '" value="' + methods[i] + up.id + '" />';
                
                // Generate some curried handlers in the global namespace because the applet sucks!
                window[methods[i] + up.id] = curriedHandler(up.id, methods[i]);
            }

            html += '<param name="mxAgentList" value="' + up.settings.signiant_agent_list +'"/>' + 
                '<param name="mxFallbackURLList" value="' + up.settings.signiant_agent_list + '"/>' + 
            	'<param name="type" value="application/x-java-applet;version=1.5"/>' + 
            	'<param name="MAYSCRIPT"/>' + 
            	'<param name="scriptable"/>' + 
            '</object>';
            
            return html;
        };
    })();
    
    // Java detection
    deployJava={debug:null,firefoxJavaVersion:null,myInterval:null,preInstallJREList:null,returnPage:null,brand:null,locale:null,installType:null,EAInstallEnabled:false,EarlyAccessURL:null,getJavaURL:'http://java.sun.com/webapps/getjava/BrowserRedirect?host=java.com',appleRedirectPage:'http://www.apple.com/support/downloads/',oldMimeType:'application/npruntime-scriptable-plugin;DeploymentToolkit',mimeType:'application/java-deployment-toolkit',launchButtonPNG:'http://java.sun.com/products/jfc/tsc/articles/swing2d/webstart.png',browserName:null,browserName2:null,getJREs:function(){var list=new Array();if(deployJava.isPluginInstalled()){var plugin=deployJava.getPlugin();var VMs=plugin.jvms;for(var i=0;i<VMs.getLength();i++){list[i]=VMs.get(i).version;}}else{var browser=deployJava.getBrowser();if(browser=='MSIE'){if(deployJava.testUsingActiveX('1.7.0')){list[0]='1.7.0';}else if(deployJava.testUsingActiveX('1.6.0')){list[0]='1.6.0';}else if(deployJava.testUsingActiveX('1.5.0')){list[0]='1.5.0';}else if(deployJava.testUsingActiveX('1.4.2')){list[0]='1.4.2';}else if(deployJava.testForMSVM()){list[0]='1.1';}}else if(browser=='Netscape Family'){deployJava.getJPIVersionUsingMimeType();if(deployJava.firefoxJavaVersion!=null){list[0]=deployJava.firefoxJavaVersion;}else if(deployJava.testUsingMimeTypes('1.7')){list[0]='1.7.0';}else if(deployJava.testUsingMimeTypes('1.6')){list[0]='1.6.0';}else if(deployJava.testUsingMimeTypes('1.5')){list[0]='1.5.0';}else if(deployJava.testUsingMimeTypes('1.4.2')){list[0]='1.4.2';}else if(deployJava.browserName2=='Safari'){if(deployJava.testUsingPluginsArray('1.7.0')){list[0]='1.7.0';}else if(deployJava.testUsingPluginsArray('1.6')){list[0]='1.6.0';}else if(deployJava.testUsingPluginsArray('1.5')){list[0]='1.5.0';}else if(deployJava.testUsingPluginsArray('1.4.2')){list[0]='1.4.2';}}}}
    if(deployJava.debug){for(var i=0;i<list.length;++i){alert('We claim to have detected Java SE '+list[i]);}}
    return list;},installJRE:function(requestVersion){var ret=false;if(deployJava.isPluginInstalled()){if(deployJava.getPlugin().installJRE(requestVersion)){deployJava.refresh();if(deployJava.returnPage!=null){document.location=deployJava.returnPage;}
    return true;}else{return false;}}else{return deployJava.installLatestJRE();}},installLatestJRE:function(){if(deployJava.isPluginInstalled()){if(deployJava.getPlugin().installLatestJRE()){deployJava.refresh();if(deployJava.returnPage!=null){document.location=deployJava.returnPage;}
    return true;}else{return false;}}else{var browser=deployJava.getBrowser();var platform=navigator.platform.toLowerCase();if((deployJava.EAInstallEnabled=='true')&&(platform.indexOf('win')!=-1)&&(deployJava.EarlyAccessURL!=null)){deployJava.preInstallJREList=deployJava.getJREs();if(deployJava.returnPage!=null){deployJava.myInterval=setInterval("deployJava.poll()",3000);}
    location.href=deployJava.EarlyAccessURL;return false;}else{if(browser=='MSIE'){return deployJava.IEInstall();}else if((browser=='Netscape Family')&&(platform.indexOf('win32')!=-1)){return deployJava.FFInstall();}else{location.href=deployJava.getJavaURL+
    ((deployJava.returnPage!=null)?('&returnPage='+deployJava.returnPage):'')+
    ((deployJava.locale!=null)?('&locale='+deployJava.locale):'')+
    ((deployJava.brand!=null)?('&brand='+deployJava.brand):'');}
    return false;}}},runApplet:function(attributes,parameters,minimumVersion){if(minimumVersion=='undefined'||minimumVersion==null){minimumVersion='1.1';}
    var regex="^(\\d+)(?:\\.(\\d+)(?:\\.(\\d+)(?:_(\\d+))?)?)?$";var matchData=minimumVersion.match(regex);if(deployJava.returnPage==null){deployJava.returnPage=document.location;}
    if(matchData!=null){var browser=deployJava.getBrowser();if((browser!='?')&&('Safari'!=deployJava.browserName2)){if(deployJava.versionCheck(minimumVersion+'+')){deployJava.writeAppletTag(attributes,parameters);}else if(deployJava.installJRE(minimumVersion+'+')){deployJava.refresh();location.href=document.location;deployJava.writeAppletTag(attributes,parameters);}}else{deployJava.writeAppletTag(attributes,parameters);}}else{if(deployJava.debug){alert('Invalid minimumVersion argument to runApplet():'+
    minimumVersion);}}},writeAppletTag:function(attributes,parameters){var s='<'+'applet ';var codeAttribute=false;for(var attribute in attributes){s+=(' '+attribute+'="'+attributes[attribute]+'"');if(attribute=='code'){codeAttribute=true;}}
    if(!codeAttribute){s+=(' code="dummy"');}
    s+='>';document.write(s);if(parameters!='undefined'&&parameters!=null){var codebaseParam=false;for(var parameter in parameters){if(parameter=='codebase_lookup'){codebaseParam=true;}
    s='<param name="'+parameter+'" value="'+
    parameters[parameter]+'">';document.write(s);}
    if(!codebaseParam){document.write('<param name="codebase_lookup" value="false">');}}
    document.write('<'+'/'+'applet'+'>');},versionCheck:function(versionPattern)
    {var index=0;var regex="^(\\d+)(?:\\.(\\d+)(?:\\.(\\d+)(?:_(\\d+))?)?)?(\\*|\\+)?$";var matchData=versionPattern.match(regex);if(matchData!=null){var familyMatch=true;var patternArray=new Array();for(var i=1;i<matchData.length;++i){if((typeof matchData[i]=='string')&&(matchData[i]!='')){patternArray[index]=matchData[i];index++;}}
    if(patternArray[patternArray.length-1]=='+'){familyMatch=false;patternArray.length--;}else{if(patternArray[patternArray.length-1]=='*'){patternArray.length--;}}
    var list=deployJava.getJREs();for(var i=0;i<list.length;++i){if(deployJava.compareVersionToPattern(list[i],patternArray,familyMatch)){return true;}}
    return false;}else{alert('Invalid versionPattern passed to versionCheck: '+
    versionPattern);return false;}},isWebStartInstalled:function(minimumVersion){var browser=deployJava.getBrowser();if((browser=='?')||('Safari'==deployJava.browserName2)){return true;}
    if(minimumVersion=='undefined'||minimumVersion==null){minimumVersion='1.4.2';}
    var retval=false;var regex="^(\\d+)(?:\\.(\\d+)(?:\\.(\\d+)(?:_(\\d+))?)?)?$";var matchData=minimumVersion.match(regex);if(matchData!=null){retval=deployJava.versionCheck(minimumVersion+'+');}else{if(deployJava.debug){alert('Invalid minimumVersion argument to isWebStartInstalled(): '+minimumVersion);}
    retval=deployJava.versionCheck('1.4.2+');}
    return retval;},getJPIVersionUsingMimeType:function(){for(var i=0;i<navigator.mimeTypes.length;++i){var s=navigator.mimeTypes[i].type;var m=s.match(/^application\/x-java-applet;jpi-version=(.*)$/);if(m!=null){deployJava.firefoxJavaVersion=m[1];if('Opera'!=deployJava.browserName2){break;}}}},launchWebStartApplication:function(jnlp){return false;},createWebStartLaunchButtonEx:function(jnlp,minimumVersion){if(deployJava.returnPage==null){deployJava.returnPage=jnlp;}
    var url='javascript:deployJava.launchWebStartApplication(\''+jnlp+'\');';document.write('<'+'a href="'+url+'" onMouseOver="window.status=\'\'; '+'return true;"><'+'img '+'src="'+deployJava.launchButtonPNG+'" '+'border="0" /><'+'/'+'a'+'>');},createWebStartLaunchButton:function(jnlp,minimumVersion){if(deployJava.returnPage==null){deployJava.returnPage=jnlp;}
    var url='javascript:'+'if (!deployJava.isWebStartInstalled(&quot;'+
    minimumVersion+'&quot;)) {'+'if (deployJava.installLatestJRE()) {'+'if (deployJava.launch(&quot;'+jnlp+'&quot;)) {}'+'}'+'} else {'+'if (deployJava.launch(&quot;'+jnlp+'&quot;)) {}'+'}';document.write('<'+'a href="'+url+'" onMouseOver="window.status=\'\'; '+'return true;"><'+'img '+'src="'+deployJava.launchButtonPNG+'" '+'border="0" /><'+'/'+'a'+'>');},launch:function(jnlp){document.location=jnlp;return true;},isPluginInstalled:function(){var plugin=deployJava.getPlugin();if(plugin&&plugin.jvms){return true;}else{return false;}},isAutoUpdateEnabled:function(){if(deployJava.isPluginInstalled()){return deployJava.getPlugin().isAutoUpdateEnabled();}
    return false;},setAutoUpdateEnabled:function(){if(deployJava.isPluginInstalled()){return deployJava.getPlugin().setAutoUpdateEnabled();}
    return false;},setInstallerType:function(type){deployJava.installType=type;if(deployJava.isPluginInstalled()){return deployJava.getPlugin().setInstallerType(type);}
    return false;},setAdditionalPackages:function(packageList){if(deployJava.isPluginInstalled()){return deployJava.getPlugin().setAdditionalPackages(packageList);}
    return false;},setEarlyAccess:function(enabled){deployJava.EAInstallEnabled=enabled;},isPlugin2:function(){if(deployJava.isPluginInstalled()){if(deployJava.versionCheck('1.6.0_10+')){try{return deployJava.getPlugin().isPlugin2();}catch(err){}}}
    return false;},allowPlugin:function(){deployJava.getBrowser();var ret=('Safari'!=deployJava.browserName2&&'Opera'!=deployJava.browserName2);return ret;},getPlugin:function(){deployJava.refresh();var ret=null;if(deployJava.allowPlugin()){ret=document.getElementById('deployJavaPlugin');}
    return ret;},compareVersionToPattern:function(version,patternArray,familyMatch){var regex="^(\\d+)(?:\\.(\\d+)(?:\\.(\\d+)(?:_(\\d+))?)?)?$";var matchData=version.match(regex);if(matchData!=null){var index=0;var result=new Array();for(var i=1;i<matchData.length;++i){if((typeof matchData[i]=='string')&&(matchData[i]!=''))
    {result[index]=matchData[i];index++;}}
    var l=Math.min(result.length,patternArray.length);if(familyMatch){for(var i=0;i<l;++i){if(result[i]!=patternArray[i])return false;}
    return true;}else{for(var i=0;i<l;++i){if(result[i]<patternArray[i]){return false;}else if(result[i]>patternArray[i]){return true;}}
    return true;}}else{return false;}},getBrowser:function(){if(deployJava.browserName==null){var browser=navigator.userAgent.toLowerCase();if(deployJava.debug){alert('userAgent -> '+browser);}
    if(browser.indexOf('msie')!=-1){deployJava.browserName='MSIE';deployJava.browserName2='MSIE';}else if(browser.indexOf('firefox')!=-1){deployJava.browserName='Netscape Family';deployJava.browserName2='Firefox';}else if(browser.indexOf('chrome')!=-1){deployJava.browserName='Netscape Family';deployJava.browserName2='Chrome';}else if(browser.indexOf('safari')!=-1){deployJava.browserName='Netscape Family';deployJava.browserName2='Safari';}else if(browser.indexOf('mozilla')!=-1){deployJava.browserName='Netscape Family';deployJava.browserName2='Other';}else if(browser.indexOf('opera')!=-1){deployJava.browserName='Netscape Family';deployJava.browserName2='Opera';}else{deployJava.browserName='?';deployJava.browserName2='unknown';}
    if(deployJava.debug){alert('Detected browser name:'+deployJava.browserName+', '+deployJava.browserName2);}}
    return deployJava.browserName;},testUsingActiveX:function(version){var objectName='JavaWebStart.isInstalled.'+version+'.0';if(!ActiveXObject){if(deployJava.debug){alert('Browser claims to be IE, but no ActiveXObject object?');}
    return false;}
    try{return(new ActiveXObject(objectName)!=null);}catch(exception){return false;}},testForMSVM:function(){var clsid='{08B0E5C0-4FCB-11CF-AAA5-00401C608500}';if(typeof oClientCaps!='undefined'){var v=oClientCaps.getComponentVersion(clsid,"ComponentID");if((v=='')||(v=='5,0,5000,0')){return false;}else{return true;}}else{return false;}},testUsingMimeTypes:function(version){if(!navigator.mimeTypes){if(deployJava.debug){alert('Browser claims to be Netscape family, but no mimeTypes[] array?');}
    return false;}
    for(var i=0;i<navigator.mimeTypes.length;++i){s=navigator.mimeTypes[i].type;var m=s.match(/^application\/x-java-applet\x3Bversion=(1\.8|1\.7|1\.6|1\.5|1\.4\.2)$/);if(m!=null){if(deployJava.compareVersions(m[1],version)){return true;}}}
    return false;},testUsingPluginsArray:function(version){if((!navigator.plugins)||(!navigator.plugins.length)){return false;}
    var platform=navigator.platform.toLowerCase();for(var i=0;i<navigator.plugins.length;++i){s=navigator.plugins[i].description;if(s.search(/^Java Switchable Plug-in (Cocoa)/)!=-1){if(deployJava.compareVersions("1.5.0",version)){return true;}}else if(s.search(/^Java/)!=-1){if(platform.indexOf('win')!=-1){if(deployJava.compareVersions("1.5.0",version)||deployJava.compareVersions("1.6.0",version)){return true;}}}}
    if(deployJava.compareVersions("1.5.0",version)){return true;}
    return false;},IEInstall:function(){location.href=deployJava.getJavaURL+
    ((deployJava.returnPage!=null)?('&returnPage='+deployJava.returnPage):'')+
    ((deployJava.locale!=null)?('&locale='+deployJava.locale):'')+
    ((deployJava.brand!=null)?('&brand='+deployJava.brand):'')+
    ((deployJava.installType!=null)?('&type='+deployJava.installType):'');return false;},done:function(name,result){},FFInstall:function(){location.href=deployJava.getJavaURL+
    ((deployJava.returnPage!=null)?('&returnPage='+deployJava.returnPage):'')+
    ((deployJava.locale!=null)?('&locale='+deployJava.locale):'')+
    ((deployJava.brand!=null)?('&brand='+deployJava.brand):'')+
    ((deployJava.installType!=null)?('&type='+deployJava.installType):'');return false;},compareVersions:function(installed,required){var a=installed.split('.');var b=required.split('.');for(var i=0;i<a.length;++i){a[i]=Number(a[i]);}
    for(var i=0;i<b.length;++i){b[i]=Number(b[i]);}
    if(a.length==2){a[2]=0;}
    if(a[0]>b[0])return true;if(a[0]<b[0])return false;if(a[1]>b[1])return true;if(a[1]<b[1])return false;if(a[2]>b[2])return true;if(a[2]<b[2])return false;return true;},enableAlerts:function(){deployJava.browserName=null;deployJava.debug=true;},poll:function(){deployJava.refresh();var postInstallJREList=deployJava.getJREs();if((deployJava.preInstallJREList.length==0)&&(postInstallJREList.length!=0)){clearInterval(deployJava.myInterval);if(deployJava.returnPage!=null){location.href=deployJava.returnPage;};}
    if((deployJava.preInstallJREList.length!=0)&&(postInstallJREList.length!=0)&&(deployJava.preInstallJREList[0]!=postInstallJREList[0])){clearInterval(deployJava.myInterval);if(deployJava.returnPage!=null){location.href=deployJava.returnPage;}}},writePluginTag:function(){var browser=deployJava.getBrowser();if(browser=='MSIE'){document.write('<'+'object classid="clsid:CAFEEFAC-DEC7-0000-0000-ABCDEFFEDCBA" '+'id="deployJavaPlugin" width="0" height="0">'+'<'+'/'+'object'+'>');}else if(browser=='Netscape Family'&&deployJava.allowPlugin()){deployJava.writeEmbedTag();}},refresh:function(){navigator.plugins.refresh(false);var browser=deployJava.getBrowser();if(browser=='Netscape Family'&&deployJava.allowPlugin()){var plugin=document.getElementById('deployJavaPlugin');if(plugin==null){deployJava.writeEmbedTag();}}},writeEmbedTag:function(){var written=false;if(navigator.mimeTypes!=null){for(var i=0;i<navigator.mimeTypes.length;i++){if(navigator.mimeTypes[i].type==deployJava.mimeType){if(navigator.mimeTypes[i].enabledPlugin){document.write('<'+'embed id="deployJavaPlugin" type="'+
    deployJava.mimeType+'" hidden="true" />');written=true;}}}
    if(!written)for(var i=0;i<navigator.mimeTypes.length;i++){if(navigator.mimeTypes[i].type==deployJava.oldMimeType){if(navigator.mimeTypes[i].enabledPlugin){document.write('<'+'embed id="deployJavaPlugin" type="'+
    deployJava.oldMimeType+'" hidden="true" />');}}}}},do_initialize:function(){deployJava.writePluginTag();if(deployJava.locale==null){var loc=null;if(loc==null)try{loc=navigator.userLanguage;}catch(err){}
    if(loc==null)try{loc=navigator.systemLanguage;}catch(err){}
    if(loc==null)try{loc=navigator.language;}catch(err){}
    if(loc!=null){loc.replace("-","_")
    deployJava.locale=loc;}}}};deployJava.do_initialize();


})(plupload);

});