clear all
close all
clc
[filename,filepath]=uigetfile('*.csv');
Raw_Data=dlmread(fullfile(filepath,filename),';',1,0);
fid=fopen(fullfile(filepath,filename));
A=textscan(fid,'%s',size(Raw_Data,2)*2-1);
A=A{1};
answer = questdlg('2D or 3D Data?', ...
    '3D or 2D', ...
    '2D','3D','I'' m confussed','I'' m confussed');
switch answer
    case '2D'
        sperator = 2;
    case '3D'
        sperator = 3;
    case 'I'' m confussed'
        disp('SYSTEM OVERLOAD KILLING MYSELF')
        sys;
end
% _x etc delete
for i=1:2:(size(Raw_Data,2)*2-1)
    A{i}(end-1:end) =[];
end
% getting to know the header - cant use unique, because change in orders
j=1;
for i=1:sperator*2:(size(Raw_Data,2)*2-1)
    header{1,j}=A{i};
    header{2,j}=(j-1)*sperator+1;
    j=j+1;
end


plot(distance_points(Raw_Data,sperator,13,16))
figure()
plot(angle_3points(Raw_Data,sperator,7,13,16))
figure()
plot(angle_4points(Raw_Data,sperator,7,13,13,16))

function distance=distance_points(raw_data,seperator,P1,P2)
%distance between P1 and P2
for i=1:1:size(raw_data,1)
    distance(i,1)=norm( raw_data(i,P2:1:P2+seperator-1)...
                       -raw_data(i,P1:1:P1+seperator-1),2);
end
end

function angle=angle_3points(raw_data,seperator,P1,P2,P3)
%angle between P1 and P3, vertex at P2
    u=raw_data(:,P1:1:P1+seperator-1)-raw_data(:,P2:1:P2+seperator-1);
    v=raw_data(:,P3:1:P3+seperator-1)-raw_data(:,P2:1:P2+seperator-1);
for i=1:1:size(raw_data,1)
    angle(i,1)=atan2d(norm(cross(u(i,1:3)',v(i,1:3)')),dot(u(i,1:3)',v(i,1:3)'));
end
end


function angle=angle_4points(raw_data,seperator,P1,P2,P3,P4)
%angle between the vectors P1P2 and P3P4
        u=raw_data(:,P1:1:P1+seperator-1)-raw_data(:,P2:1:P2+seperator-1);
        v=raw_data(:,P4:1:P4+seperator-1)-raw_data(:,P3:1:P3+seperator-1);
for i=1:1:size(raw_data,1)
    angle(i,1)=atan2d(norm(cross(u(i,1:3)',v(i,1:3)')),dot(u(i,1:3)',v(i,1:3)'));
end
end




