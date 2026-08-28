extends SceneTree

func _init():
    print("Starting PCK packing...")
    var packer = PCKPacker.new()
    var err = packer.pck_start("../CrazyCattle3D.pck")
    if err != OK:
        print("Failed to start pck: ", err)
        quit(1)
        return
    add_dir(packer, "res://")
    packer.flush()
    print("PCK created successfully!")
    quit(0)

func add_dir(packer: PCKPacker, path: String):
    var dir = DirAccess.open(path)
    if dir:
        dir.list_dir_begin()
        var file_name = dir.get_next()
        while file_name != "":
            if file_name != "." and file_name != ".." and file_name != ".git" and file_name != "_remap_backup":
                var full_path = path.path_join(file_name)
                if dir.current_is_dir():
                    add_dir(packer, full_path)
                else:
                    packer.add_file(full_path, full_path)
            file_name = dir.get_next()
